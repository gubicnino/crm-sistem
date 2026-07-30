---
name: email-sequences
description: 'Follow-up email mechanics for the CRM: reserve->send protocol against Resend scheduled_at, cancellation semantics, per-step stage conditions, "apply to existing leads" re-enrollment, manual broadcasts, and the daily cron reconciler. Load before touching lib/email/**, lib/cron/**, app/api/cron/**, or app/(dashboard)/emails/**.'
user-invocable: false
---

# Email sequences

Sequences are trainer data (`email_sequences` / `email_sequence_steps` rows edited at `/emails/sequences`), not code — never inline sequence/step logic in a route handler or Server Action; go through `db/queries/email-sequences.ts` and `lib/email/enroll.ts`. CLAUDE.md's cancellation-is-mandatory rule is the one invariant that must never regress; everything below exists to make that hold under retries, edits, and re-enrollment.

## The reserve → send protocol

`lib/email/enroll.ts`'s `scheduleStepsForLead` is the shared helper both `enrollLeadOnCreate` (new lead) and `enrollLeadOnStageEntered` (`stage_entered` trigger) call:

1. `reserveScheduledEmails` inserts one `scheduled_emails` row per step first, `status: "pending"`, claiming `(leadId, sequenceStep, attempt)` via a unique index — this is what makes enrollment idempotent (a repeat call just no-ops on rows that already exist).
2. `sendReservedStep` (`lib/email/schedule.ts`) then calls `resend.emails.send(..., { idempotencyKey: row.id })` using the reserved row's own id as the key — a retried send (crash, timeout, cron reconciler) returns the *same* Resend email id instead of creating a duplicate schedule.
3. On success, `resendEmailId` + `status: "scheduled"` are persisted. **A `resendEmailId` that was never persisted can never be canceled — treat a missing one as a bug.** On failure the row stays `pending` with `lastError` set, for the reconciler to retry — `sendReservedStep` never throws.

Day-0 steps schedule `now + IMMEDIATE_SEND_DELAY_SECONDS` (60s), not immediately — one uniform scheduled-send code path, and a real (if brief) cancellation window even for the instant confirmation email.

Constants (`lib/email/constants.ts`), all deliberate product/technical caps — do not raise without asking (CLAUDE.md):
- `MAX_SCHEDULE_DAYS = 30` — Resend's hard ceiling, enforced by `emailSequenceStepSchema`.
- `IDEMPOTENCY_KEY_TTL_HOURS = 24` — the reconciler must never retry a `pending` row older than this.
- `RECONCILE_RETRY_MIN_MINUTES = 15` / `RECONCILE_RETRY_MAX_HOURS = 20` — retry window; older `pending` rows are marked `orphaned` and never retried, leaving margin before the 24h key TTL.
- `MAX_SEQUENCES_PER_TRAINER = 5`, `MAX_STEPS_PER_SEQUENCE = 15`, `MAX_APPLY_TO_EXISTING_LEADS_PER_RUN = 200`, `MAX_BROADCAST_RECIPIENTS = 500`.

## Cancellation (`lib/email/cancel.ts`)

`cancelRow` is the single chokepoint all cancellation goes through — never call `resend.emails.cancel()` elsewhere, and never call it in parallel across rows (one row's failure must not abort the rest of a sequential loop).

Resend's cancel response is genuinely ambiguous and was verified live — preserve this exactly:
- `validation_error` with `"...not scheduled..."` in the message = **reliably already sent** → mark `sent`.
- `not_found` is **not** a reliable "already sent" signal — canceling within ~1s of scheduling returned `not_found` for an email that was still genuinely pending and cancelable moments later. Treating it as "already sent" risks abandoning a still-live send. It falls through to `cancel_failed` for the reconciler to retry.

Three callers, one contract:
- `cancelSequenceForLead` — one lead, called from `setLeadStage` (→ `client`/`lost`), the unsubscribe page, and the trainer's manual stop-sequence action.
- `cancelAllSequencesForTrainer` — every row across a trainer, the mandatory first step of `deactivateTrainerAction` (cancel *before* flagging deactivated — see `admin-console` skill).
- `syncScheduledEmailsForLeadStage` — re-evaluates every not-yet-sent row whose step has a `sendOnlyIfStage` condition, canceling any that now excludes the lead's new stage. This is the *entire* enforcement mechanism for that condition: Resend already has the send request by the time the condition would need re-checking, so there is no send-time hook — exclusion is enforced by canceling the row first. Called on every **non-terminal** stage change (terminal changes already go through `cancelSequenceForLead`, which cancels unconditionally and makes this redundant). One-directional: moving back into a matching stage never re-schedules an already-canceled step.

## Apply to existing leads (`lib/email/reapply.ts`)

The trainer's "Uporabi za obstoječe stranke" action. Re-enrolls every lead currently enrolled in a sequence using its *current* steps (after the trainer's edit), anchored to each lead's own original `enrolledAt` — a recomputed date that's already passed is skipped, never sent late. Each re-enrolled step goes in at `attempt + 1` for that `(leadId, sequenceStep)` pair, so the unique index never collides with the original send.

Cancellation is **re-verified, not assumed**: after asking Resend to cancel a lead's outstanding rows, the code re-fetches that lead's row history and only re-reserves a step whose prior row actually resolved to `canceled` or `sent`. A row still `scheduled` / `pending` / `cancel_failed` / `orphaned` blocks re-reservation of that step this run (`UNRESOLVED_AFTER_CANCEL_STATUSES`) — reserving anyway risks handing Resend a second live schedule for the same logical step. Skips a lead entirely if they've unsubscribed or reached a terminal stage since original enrollment.

## Manual broadcasts (`lib/email/broadcast.ts`, `/emails/send`)

One-off, not a sequence — one `email_broadcasts` row + one `scheduled_emails` row per recipient (`kind: "broadcast"`), capped at `MAX_BROADCAST_RECIPIENTS`. Immutable once created: no edit path, only cancellation through the same rows. The compose form mints `clientRequestId` **once per compose session, up front** — never regenerate it per submit attempt — so a double-click or retried request resolves to the same broadcast (`getOrCreateEmailBroadcast`) instead of double-sending; this is what makes the `scheduled_emails` unique index actually able to catch the duplicate.

## Daily cron (`lib/cron/daily.ts`, `app/api/cron/daily/route.ts`)

Housekeeping only — never sends sequence emails, that's Resend's job. Idempotent via `cron_runs.run_date` (unique per calendar day, UTC — `startCronRunIfNotAlreadyRun` makes a second same-day trigger a safe no-op). Composes three independent steps, each internally capped (`lib/cron/limits.ts`) and bailing rather than silently truncating if a run would exceed its cap:
- `reconcile()` (`lib/cron/reconcile.ts`) — enrolls leads with zero `scheduled_emails` rows (Resend/DB was down at creation), and retries `pending` rows inside the safe retry window, skipping any lead that's since unsubscribed or gone terminal.
- `sendDailyDigests()` — per-trainer new/stuck-lead summary.
- `cleanupExpiredRows()`.

Protected by `CRON_SECRET` bearer token (401 otherwise). Fires anywhere within its scheduled UTC hour — never write logic that assumes precise timing or a local timezone.

import { addDays } from "date-fns";
import { reserveScheduledEmails, updateScheduledEmail } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { Lead, ScheduledEmail } from "@/db/schema";
import { resend, FROM_EMAIL } from "@/lib/email/client";
import { IMMEDIATE_SEND_DELAY_SECONDS } from "@/lib/email/constants";
import { renderSequenceStep } from "@/lib/email/render";
import { sequenceFor, type SequenceContext, type SequenceStep } from "@/lib/email/sequences";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

/**
 * Sends one reserved row to Resend and commits the result. Never throws —
 * a send failure leaves the row `pending` with `lastError` set, for the
 * Phase 6 reconciler to retry (using this same function) rather than losing
 * the attempt. Shared by scheduleSequenceForLead's initial pass and the
 * reconciler's retry pass, so both go through identical commit logic.
 */
async function sendReservedStep(
  row: ScheduledEmail,
  step: SequenceStep,
  ctx: SequenceContext,
  unsubLink: string,
  to: string,
  from: string,
  scheduledAt?: string,
): Promise<void> {
  const { subject, react } = renderSequenceStep(step, ctx, unsubLink);

  try {
    // Our own row id as the idempotency key: a retry of a send whose response
    // we lost (crash, timeout) returns the SAME Resend email id — the cancel
    // handle is recoverable rather than lost forever.
    const { data, error } = await resend.emails.send(
      { from, to, subject, react, scheduledAt },
      { idempotencyKey: row.id },
    );

    if (error) {
      await updateScheduledEmail(row.id, { lastError: `${error.name}: ${error.message}` });
      return;
    }

    await updateScheduledEmail(row.id, { resendEmailId: data!.id, status: "scheduled" });
  } catch (err) {
    // Defensive: Resend's SDK documents { error } rather than throwing, but
    // an unexpected network-level throw must still not abort a caller's loop.
    const message = err instanceof Error ? err.message : String(err);
    await updateScheduledEmail(row.id, { lastError: message });
  }
}

/**
 * Hands a lead's whole email sequence to Resend in one call, once — see
 * CLAUDE.md's "Follow-up emails". Three-step protocol so a crash between
 * steps can never lose the resendEmailId needed to cancel later:
 *   1. Reserve — insert all rows `pending`, onConflictDoNothing (idempotent)
 *   2. Send    — call Resend per step, using our own row id as the idempotency key
 *   3. Commit  — persist resendEmailId + status: 'scheduled'
 *
 * Called from exactly two places: db/queries/leads.ts's createLeadFromIntake
 * (on a genuine insert) and the Phase 6 cron reconciler. Never call this from
 * UI code.
 */
export async function scheduleSequenceForLead(scope: TrainerScope, lead: Lead): Promise<void> {
  if (lead.unsubscribedAt) {
    // A re-submitted form must not resurrect a sequence for someone who opted out.
    return;
  }

  const steps = sequenceFor(lead.source);
  const now = new Date();

  const reserved = await reserveScheduledEmails(
    scope,
    steps.map((step) => ({
      leadId: lead.id,
      sequenceStep: step.id,
      scheduledFor:
        step.dayOffset === 0
          ? new Date(now.getTime() + IMMEDIATE_SEND_DELAY_SECONDS * 1000)
          : addDays(now, step.dayOffset),
    })),
  );

  if (reserved.length === 0) {
    // Every step already scheduled for this lead — idempotent no-op. This is
    // what makes it safe for the reconciler to call blindly.
    return;
  }

  const trainer = await getTrainer(scope);
  const link = unsubscribeLink(lead.id);
  const ctx = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;

  for (const row of reserved) {
    const step = steps.find((s) => s.id === row.sequenceStep);
    if (!step) continue; // unreachable — sequences.ts asserts ids are stable
    await sendReservedStep(row, step, ctx, link, lead.email, from, row.scheduledFor.toISOString());
  }
}

/**
 * Retries a `pending` row within the reconciler's safe retry window (see
 * lib/email/constants.ts and db/queries/scheduled-emails.ts's
 * listRetryablePendingScheduledEmails). Sends immediately rather than
 * reusing the original (now-past) scheduledFor — the row is already late by
 * definition, so there is no remaining "future slot" to honor, and Resend's
 * scheduling semantics for a past scheduledAt are undocumented and untested
 * here. Uses the same idempotencyKey, so if the original request actually
 * did land, this call safely returns the same Resend email id instead of
 * sending a duplicate.
 */
export async function retryPendingScheduledEmail(scope: TrainerScope, row: ScheduledEmail, lead: Lead): Promise<void> {
  const step = sequenceFor(lead.source).find((s) => s.id === row.sequenceStep);
  if (!step) return; // unreachable — sequences.ts asserts ids are stable

  const trainer = await getTrainer(scope);
  const link = unsubscribeLink(lead.id);
  const ctx = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;

  await sendReservedStep(row, step, ctx, link, lead.email, from);
}

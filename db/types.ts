// TS-only value shapes referenced from db/schema.ts via $type<>(). Kept out of
// schema.ts per the drizzle skill's convention (schema imports domain types,
// domain types don't import schema).

export type ApplicationQuestionType = "text" | "textarea" | "select" | "checkbox";

/** One entry in trainers.applicationQuestions. Config, not code — see CLAUDE.md
 *  "Custom application questions": never hardcode a specific trainer's questions. */
export interface ApplicationQuestion {
  /** Stable key the trainer's form submits answers under. Matched against `^[a-z0-9_]{1,64}$`
   *  and, once in use, treated as immutable — see Phase 5's questions editor. */
  id: string;
  label: string;
  type: ApplicationQuestionType;
  required: boolean;
  /** Only meaningful for `type: "select"`. */
  options?: string[];
}

export type LeadAnswerValue = string | string[] | number | boolean;

/** Keyed by ApplicationQuestion.id. Deliberately permissive — see lib/validation/lead-intake.ts
 *  for why unknown keys are accepted rather than rejected at ingest. */
export type LeadAnswers = Record<string, LeadAnswerValue>;

/**
 * Operational lifecycle of one row in scheduled_emails. Beyond CLAUDE.md's stated
 * `scheduled | sent | canceled`:
 *  - `pending`        reserved (row exists) but not yet confirmed sent by Resend
 *  - `orphaned`        pending row aged past Resend's ~24h idempotency-key window;
 *                       never retried, since a retry past that window risks a double-send
 *  - `cancel_failed`    cancellation attempted and failed for a reason other than
 *                       "already sent"; surfaced to the cron reconciler and the digest
 */
export type ScheduledEmailStatus = "pending" | "scheduled" | "sent" | "canceled" | "orphaned" | "cancel_failed";

export interface CronRunStats {
  reconciledLeads?: number;
  reconciledSends?: number;
  orphanedEmails?: number;
  stuckLeads?: number;
  digestsSent?: number;
  cancelFailures?: number;
  bailedTasks?: string[];
  errors?: string[];
}

export type CronRunStatus = "running" | "completed" | "failed";

/** Who a login is. An "admin" (operator) has NO trainers row — no tenant of
 *  their own; they act only by impersonating a trainer (see lib/impersonation.ts).
 *  Created exclusively by scripts/create-admin.ts; there is no admin signup or
 *  invite flow. */
export type UserRole = "trainer" | "admin";

/** How an email_sequences row decides who gets enrolled. Phase 1 only ever
 *  writes "lead_created" — "stage_entered" is read/written starting Phase 3
 *  (see lib/email/enroll.ts's header comment). Text + $type<>, not a pgEnum:
 *  this is app config, not one of the two CLAUDE.md-gated enums
 *  (pipeline_stage/lead_source). */
export type EmailSequenceTriggerType = "lead_created" | "stage_entered";

/** Distinguishes a scheduled_emails row created by the sequence engine
 *  (lib/email/enroll.ts) from a future one-off broadcast (Phase 5). Every
 *  row today is "sequence"; "broadcast" is unused until Phase 5. */
export type ScheduledEmailKind = "sequence" | "broadcast";

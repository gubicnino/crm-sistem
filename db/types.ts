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

/**
 * A trainer-editable email body, Phase 2. Stored as Tiptap-compatible JSON in
 * email_sequence_steps.body (jsonb) — a restricted subset of Tiptap's actual
 * document model, not the full thing. lib/validation/email-doc.ts is the
 * runtime security boundary that enforces this subset (allowed node/mark
 * types, safe link protocols, bounded depth/size, a closed variable-name
 * list) before anything here reaches the database. lib/email/rich-text.tsx
 * is the matching renderer: a `switch` on `type` that silently skips
 * anything not listed, so even a row that somehow bypassed validation can
 * never render an arbitrary node.
 *
 * Two structural tiers, matching Tiptap's own doc/block/inline model:
 *  - block nodes  (doc's direct content): paragraph, heading, bulletList,
 *    orderedList, ctaButton
 *  - inline nodes (paragraph/heading/listItem content): text, variable,
 *    hardBreak
 * listItem content is deliberately restricted to a single paragraph — no
 * nested lists or multi-paragraph list items — to keep both the schema and
 * the renderer small; revisit only if a trainer genuinely needs more.
 */
export type EmailDocMarkType = "bold" | "italic" | "link";

export interface EmailDocMark {
  type: EmailDocMarkType;
  /** Only present (and only meaningful) for `type: "link"`. */
  attrs?: { href?: string };
}

export type EmailDocNodeType =
  | "doc"
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "listItem"
  | "ctaButton"
  | "hardBreak"
  | "text"
  | "variable";

/** The two lead/trainer fields a trainer can reference from the editor —
 *  see lib/email/rich-text.tsx's resolveVariable. Deliberately closed: this
 *  is the whole set of data a step is allowed to interpolate. */
export type EmailDocVariableName = "leadName" | "trainerName";

export interface EmailDocNode {
  type: EmailDocNodeType;
  /** heading: { level: 2 | 3 }. ctaButton: { href, label }. variable: { name }. */
  attrs?: { level?: 2 | 3; href?: string; label?: string; name?: EmailDocVariableName };
  content?: EmailDocNode[];
  /** Only present for `type: "text"`. */
  text?: string;
  /** Only present for `type: "text"`. */
  marks?: EmailDocMark[];
}

/** The root node — always `type: "doc"`. Alias kept distinct from
 *  EmailDocNode so call sites reading `email_sequence_steps.body` can say
 *  what they mean: "a whole document," not "any node in one." */
export type EmailDoc = EmailDocNode;

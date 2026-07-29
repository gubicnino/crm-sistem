import type { AdapterAccountType } from "@auth/core/adapters";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, timestamps, timestamptz } from "./_helpers";
import type {
  ApplicationQuestion,
  CronRunStats,
  CronRunStatus,
  EmailDoc,
  EmailSequenceTriggerType,
  LeadAnswers,
  ScheduledEmailKind,
  ScheduledEmailStatus,
  UserRole,
} from "./types";

// ---------------------------------------------------------------------------
// Enums
//
// The vendored drizzle skill (.claude/skills/drizzle) defaults to avoiding
// pgEnum in favor of text + $type<>(), because value sets normally evolve.
// These two deviate deliberately: CLAUDE.md mandates a real Postgres enum for
// pipeline stages and explicitly gates changing either set behind "ask first"
// (see CLAUDE.md "When unsure" and "Pipeline stages"). Both value sets are
// product vocabulary the whole app branches on, not operational plumbing.
// ---------------------------------------------------------------------------

export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "email_lead",
  "application_received",
  "contacted",
  "client",
  "lost",
]);

export const leadSourceEnum = pgEnum("lead_source", ["application", "lead_magnet"]);

// ---------------------------------------------------------------------------
// Auth.js adapter tables
//
// Custom tables passed explicitly to PostgresDrizzleAdapter(db, { usersTable,
// accountsTable, sessionsTable, verificationTokensTable }) in lib/auth.ts
// (Phase 2) rather than relying on the adapter's defaults — this lets column
// names follow this project's snake_case convention while the TS property
// names still match what @auth/core's Adapter/AdapterUser/AdapterAccount
// types require verbatim (e.g. `refresh_token`, `providerAccountId`).
// No `authenticators` table: WebAuthn/passkeys are out of scope (Credentials
// + email only), and the adapter methods that need it are never called.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  /** Set only for the Credentials provider. Null is valid (e.g. a future OAuth-only user). */
  passwordHash: text("password_hash"),
  /** text + $type<> rather than a pgEnum, per the vendored drizzle skill —
   *  CLAUDE.md's "ask first" enum gate covers pipeline_stage/lead_source only.
   *  An "admin" (operator) row has no matching trainers row — see UserRole. */
  role: text("role").$type<UserRole>().notNull().default("trainer"),
  ...timestamps,
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

/**
 * Created by the adapter contract but functionally inert: Auth.js v5's Credentials
 * provider forces `session.strategy: 'jwt'` (see lib/auth.ts), so no row here is ever
 * read on a request. Kept so the adapter's shape holds and an OAuth provider could be
 * added later without a migration — do not remove this as unused.
 */
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const trainers = pgTable(
  "trainers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    siteKey: text("site_key").notNull().unique(),
    applicationQuestions: jsonb("application_questions").$type<ApplicationQuestion[]>().notNull().default([]),
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    /** Per-trainer override of the RFC "Name <email>" sequence sender, e.g.
     *  "Janez Novak <janez@sub.innosplet.com>". Null falls back to the global
     *  RESEND_FROM_EMAIL. Set only via scripts/set-trainer-from.ts — the
     *  domain must already be verified in Resend by the operator; this column
     *  does not verify anything itself. */
    fromEmail: text("from_email"),
    /** Set by the operator console (lib/actions/admin.ts) to lock a trainer
     *  out. A soft state, not a hard delete — see db/queries/admin.ts's
     *  deactivateTrainer for why (cancels Resend sequences first). Null = active. */
    deactivatedAt: timestamptz("deactivated_at"),
    ...timestamps,
  },
  (t) => [
    // Enforces one-login-per-trainer at the DB level, per CLAUDE.md's "ask before
    // introducing multi-user-per-trainer (team accounts)".
    uniqueIndex("trainers_user_id_unique").on(t.userId),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainerId: uuid("trainer_id")
      .notNull()
      .references(() => trainers.id, { onDelete: "cascade" }),
    // Nullable: a lead_magnet lead may only ever give an email.
    name: text("name"),
    email: text("email").notNull(),
    phone: text("phone"),
    source: leadSourceEnum("source").notNull(),
    // No DB-level default: the app always sets this explicitly on insert based on
    // `source` (application -> application_received, lead_magnet -> email_lead) —
    // see CLAUDE.md "Two lead sources". A default here could silently paper over
    // that branch being forgotten.
    stage: pipelineStageEnum("stage").notNull(),
    answers: jsonb("answers").$type<LeadAnswers>(),
    /** Set whenever `stage` changes. Drives stuck-lead detection (Phase 6) —
     *  distinct from `updatedAt`, which moves on any edit, not just stage changes. */
    stageChangedAt: timestamptz("stage_changed_at").notNull().defaultNow(),
    unsubscribedAt: timestamptz("unsubscribed_at"),
    ...timestamps,
  },
  (t) => [
    index("leads_trainer_id_stage_idx").on(t.trainerId, t.stage),
    index("leads_trainer_id_created_at_idx").on(t.trainerId, t.createdAt.desc()),
    // Makes public ingest an upsert: a repeat submission (same trainer/email)
    // updates the existing lead instead of creating a duplicate, and —
    // because scheduling only fires on a genuine insert — can't
    // double-schedule a sequence. Matched by email alone (not email+source):
    // a lead_magnet contact who later submits the full application form
    // merges into the same row rather than creating a second one — see
    // createLeadFromIntake in db/queries/leads.ts.
    uniqueIndex("leads_trainer_id_email_unique").on(t.trainerId, t.email),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Denormalized alongside leadId per CLAUDE.md: "every domain table has a trainer_id column".
    trainerId: uuid("trainer_id")
      .notNull()
      .references(() => trainers.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("notes_trainer_id_lead_id_created_at_idx").on(t.trainerId, t.leadId, t.createdAt.desc())],
);

export const emailSequences = pgTable(
  "email_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainerId: uuid("trainer_id")
      .notNull()
      .references(() => trainers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** text + $type<>, not a pgEnum — see the EmailSequenceTriggerType doc in
     *  db/types.ts. Phase 1 only ever writes "lead_created". */
    triggerType: text("trigger_type").$type<EmailSequenceTriggerType>().notNull().default("lead_created"),
    /** Meaningful only when triggerType is "lead_created". Null = any source
     *  enrolls (mirrors the old sequences.ts having exactly one sequence per
     *  source, generalized to "a sequence can target one source or all"). */
    triggerSource: leadSourceEnum("trigger_source"),
    /** Meaningful only when triggerType is "stage_entered" (Phase 3). Always
     *  null in Phase 1 — no UI sets it yet. */
    triggerStage: pipelineStageEnum("trigger_stage"),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("email_sequences_trainer_id_idx").on(t.trainerId)],
);

export const emailSequenceSteps = pgTable(
  "email_sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Denormalized alongside sequenceId per CLAUDE.md: "every domain table
    // has a trainer_id column" (mirrors notes.trainerId next to leadId).
    trainerId: uuid("trainer_id")
      .notNull()
      .references(() => trainers.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => emailSequences.id, { onDelete: "cascade" }),
    /** 0-based order within the sequence — the UI's "move up/down". */
    position: integer("position").notNull(),
    /** Days after lead enrollment. Must be 0-MAX_SCHEDULE_DAYS (30) — enforced
     *  in lib/validation/email-sequences.ts, same ceiling the old hardcoded
     *  sequences.ts asserted at module load. */
    dayOffset: integer("day_offset").notNull(),
    subject: text("subject").notNull(),
    /** Tiptap-compatible rich-text document — see EmailDoc's doc in
     *  db/types.ts. lib/validation/email-doc.ts is the runtime security
     *  boundary; lib/email/rich-text.tsx is the matching renderer. Replaces
     *  Phase 1's `heading`/`paragraphs` columns (a heading is just an H2
     *  node inside the doc now) — see scripts/backfill-email-doc-bodies.ts
     *  for how every existing row was converted before this column went
     *  NOT NULL. */
    body: jsonb("body").$type<EmailDoc>().notNull(),
    /** Phase 3 per-step condition: null = send regardless of the lead's
     *  current stage (Phase 1/2 behavior, unchanged). Non-null = this step
     *  only sends while the lead's stage is one of these — enforced NOT at
     *  send time (Resend already has the request; there is no send-time
     *  hook) but via cancellation: lib/email/cancel.ts's
     *  syncScheduledEmailsForLeadStage cancels any not-yet-sent step whose
     *  condition excludes the lead's new stage, every time the lead's stage
     *  changes. See CLAUDE.md's architecture note on why this is a
     *  cancellation problem, not a scheduling one. Terminal stages
     *  (client/lost) are deliberately never *includable* here — a step
     *  conditioned on client/lost would compete with the mandatory
     *  cancel-on-terminal already firing on the same transition; enforced
     *  in lib/validation/email-sequences.ts. */
    sendOnlyIfStage: jsonb("send_only_if_stage").$type<PipelineStage[]>(),
    ...timestamps,
  },
  (t) => [index("email_sequence_steps_sequence_id_position_idx").on(t.sequenceId, t.position)],
);

export const scheduledEmails = pgTable(
  "scheduled_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trainerId: uuid("trainer_id")
      .notNull()
      .references(() => trainers.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** "sequence" for every row the engine creates today; "broadcast" is
     *  reserved for Phase 5's one-off sends. Lets a future /emails view tell
     *  the two apart without inferring it from stepId being null. */
    kind: text("kind").$type<ScheduledEmailKind>().notNull().default("sequence"),
    /** Stable step key. For rows created by the current engine this is an
     *  email_sequence_steps.id (uuid, as text); legacy pre-Phase-1 rows carry
     *  the old hardcoded slug (e.g. "application_day0_confirmation"). */
    sequenceStep: text("sequence_step").notNull(),
    /** Typed FK mirror of sequenceStep, added when the engine moved from
     *  hardcoded step ids to DB-backed email_sequence_steps rows. Null for
     *  rows scheduled before this migration, and set null (not cascaded) if
     *  the step is later deleted — sequenceStep remains the permanent
     *  historical key regardless. */
    stepId: uuid("step_id").references(() => emailSequenceSteps.id, { onDelete: "set null" }),
    /** Starts at 1. Phase 4 increments this when re-scheduling an
     *  already-enrolled lead after the trainer edits a sequence ("apply to
     *  existing leads"), so the same (leadId, sequenceStep) pair can be
     *  re-enrolled without violating the unique index below or losing the
     *  prior attempt's audit trail. Unused (always 1) until Phase 4. */
    attempt: integer("attempt").notNull().default(1),
    /** Null only during the reserve->send pending window (see lib/email/schedule.ts). */
    resendEmailId: text("resend_email_id"),
    scheduledFor: timestamptz("scheduled_for").notNull(),
    status: text("status").$type<ScheduledEmailStatus>().notNull().default("pending"),
    sentAt: timestamptz("sent_at"),
    canceledAt: timestamptz("canceled_at"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    // The single most important index in this schema: makes double-scheduling the
    // same step (and same re-enrollment attempt) for the same lead structurally
    // impossible, including when the cron reconciler blindly retries — see
    // lib/email/schedule.ts. Renamed (not just widened) from the old
    // (leadId, sequenceStep) index so drizzle-kit generates a clean drop+create.
    uniqueIndex("scheduled_emails_lead_id_sequence_step_attempt_unique").on(
      t.leadId,
      t.sequenceStep,
      t.attempt,
    ),
    index("scheduled_emails_status_scheduled_for_idx").on(t.status, t.scheduledFor),
  ],
);

/**
 * Rate-limit counters for the public /api/leads endpoint (and, in Phase 2, auth
 * flows). No trainerId: this is infrastructure, not a tenant-owned domain table,
 * and is deliberately exempt from the tenant-scoping audit in lib/tenant.ts.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** e.g. "leads:site:pk_janez_8f3a2b" or "leads:ip:1.2.3.4". */
    bucket: text("bucket").notNull(),
    windowStart: timestamptz("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("rate_limit_bucket_window_start_unique").on(t.bucket, t.windowStart),
    index("rate_limit_window_start_idx").on(t.windowStart),
  ],
);

/** Invite-only registration: redeeming a valid, unused, unexpired token creates a user + trainer. */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  /** sha256 hex of the raw token. The raw token is only ever in the invite link, never stored. */
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamptz("expires_at").notNull(),
  usedAt: timestamptz("used_at"),
  createdAt: createdAt(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** sha256 hex of the raw token — never store the raw token. */
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamptz("expires_at").notNull(),
  usedAt: timestamptz("used_at"),
  createdAt: createdAt(),
});

/** One row per calendar day the daily cron has run. The unique `runDate` is the
 *  idempotency primitive that makes a second same-day trigger a safe no-op. */
export const cronRuns = pgTable("cron_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runDate: date("run_date", { mode: "date" }).notNull().unique(),
  startedAt: timestamptz("started_at").notNull().defaultNow(),
  finishedAt: timestamptz("finished_at"),
  stats: jsonb("stats").$type<CronRunStats>(),
  status: text("status").$type<CronRunStatus>().notNull().default("running"),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type PipelineStage = (typeof pipelineStageEnum.enumValues)[number];
export type LeadSource = (typeof leadSourceEnum.enumValues)[number];

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Trainer = typeof trainers.$inferSelect;
export type NewTrainer = typeof trainers.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type ScheduledEmail = typeof scheduledEmails.$inferSelect;
export type NewScheduledEmail = typeof scheduledEmails.$inferInsert;

export type EmailSequence = typeof emailSequences.$inferSelect;
export type NewEmailSequence = typeof emailSequences.$inferInsert;

export type EmailSequenceStep = typeof emailSequenceSteps.$inferSelect;
export type NewEmailSequenceStep = typeof emailSequenceSteps.$inferInsert;

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type CronRun = typeof cronRuns.$inferSelect;

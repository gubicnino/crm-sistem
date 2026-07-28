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
  LeadAnswers,
  ScheduledEmailStatus,
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
  "call_scheduled",
  "offer_sent",
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
    // Makes public ingest an upsert: a repeat submission (same trainer/email/source)
    // updates the existing lead instead of creating a duplicate, and — because
    // scheduling only fires on a genuine insert — can't double-schedule a sequence.
    uniqueIndex("leads_trainer_id_email_source_unique").on(t.trainerId, t.email, t.source),
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
    /** Stable step id from lib/email/sequences.ts (e.g. "application_day0_confirmation"). */
    sequenceStep: text("sequence_step").notNull(),
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
    // same step for the same lead structurally impossible, including when the cron
    // reconciler (Phase 6) blindly retries — see lib/email/schedule.ts.
    uniqueIndex("scheduled_emails_lead_id_sequence_step_unique").on(t.leadId, t.sequenceStep),
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

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export type CronRun = typeof cronRuns.$inferSelect;

# Trainer-Editable Email Sequences — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded email sequence system (`lib/email/sequences.ts` + `lib/email/copy.ts`) with trainer-owned data: a trainer can create up to 5 sequences, each with its own steps (day offset, subject, heading, body paragraphs), edit them in the dashboard, and toggle them on/off. New leads enroll in matching sequences automatically, exactly as before, but the content and timing now come from the database instead of a deploy.

**Architecture:** No new subsystems. Two new tables (`email_sequences`, `email_sequence_steps`) plus three new columns on `scheduled_emails` (`kind`, `stepId`, `attempt`). The existing reserve → send → commit protocol in `lib/email/schedule.ts` is preserved verbatim; only what feeds it changes, from a hardcoded lookup (`sequenceFor(lead.source)`) to a DB query (`listEnabledSequencesForLeadCreated`). A brand-new `lib/email/enroll.ts` replaces `scheduleSequenceForLead`. Rich text (Tiptap), stage-triggered sequences, "apply to existing leads", and one-off broadcasts are explicitly **out of scope** — see the design doc.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM + drizzle-kit, Neon Postgres, Vitest, react-hook-form + Zod, shadcn/ui (base-ui primitives), Tailwind, Resend.

**Spec:** `C:\Users\gubic\.claude\plans\naslednja-stvar-ki-jo-reactive-treasure.md` (see its "Faza 1" section; this plan implements that section only).

## Global Constraints

- Tenant isolation: every domain-table query must go through `scoped()`/`ownedBy()` with a `TrainerScope` from `requireTrainer()` (pages) or `requireTrainerOrThrow()` (Server Actions) — never a raw `trainerId` from params/body. `email_sequences` and `email_sequence_steps` are domain tables and must follow this exactly like `leads`/`notes`.
- `no-restricted-imports` (see `eslint.config.mjs`) forbids importing `@/db` outside `db/queries/**` and `db/migrate.ts`. All new query logic lives in `db/queries/email-sequences.ts`; everything else (actions, `lib/email/enroll.ts`, pages) calls through it. Scripts use a relative `../db` import (see `scripts/seed-demo.ts`), which the rule does not match.
- `no-restricted-syntax` forbids writing `leads.stage` anywhere except `db/queries/leads.ts`. Nothing in this plan touches `leads.stage` — do not add such a call site.
- UI text: Slovenian, added only to `lib/strings.ts`'s `sl` object, grouped by surface (`sl.emails.*`). Code/comments/commits: English. Never mixed.
- ORM: Drizzle only. Schema changes go through `npx drizzle-kit generate` — never hand-write migration SQL, never edit an already-applied migration.
- Server Components by default; `"use client"` only for genuine interactivity. Server Actions for dashboard mutations (never a Route Handler for these).
- `npx tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run build` must all pass before a task is considered done. `npm run build` and the `drizzle-kit`/`db:migrate` commands require `DATABASE_URL` in `.env.local`.
- No new dependencies. Rich text (Tiptap) is explicitly Phase 2 — do not add it here.
- **Resend's scheduling ceiling is 30 days** (`MAX_SCHEDULE_DAYS` in `lib/email/constants.ts`) — every `dayOffset` must be validated against it, both in Zod and in the DB (an int column, not separately constrained at the DB level, matching how the old `sequences.ts` only asserted this at module load).
- **Cap of 5 sequences per trainer, 15 steps per sequence** — both enforced server-side (`lib/email/constants.ts`'s `MAX_SEQUENCES_PER_TRAINER`/`MAX_STEPS_PER_SEQUENCE`), not just in the UI.
- This phase touches `db/schema.ts` and several `trainerId`-scoped query paths. After the final whole-branch review, dispatch this repo's `security-reviewer` subagent (read-only; reports findings, does not fix) before considering Phase 1 done — its trigger list explicitly names `db/schema.ts` and anything reading `session`/`trainerId`.

---

## Task 1: Schema — new tables and `scheduled_emails` columns

**Files:**
- Modify: `db/schema.ts`
- Modify: `db/types.ts`
- Test: `__tests__/tenant-scoping.test.ts` (extend)
- Generate: `db/migrations/000X_*.sql` (via `drizzle-kit generate`, name auto-assigned)

**Interfaces:**
- Produces: `emailSequences`, `emailSequenceSteps` Drizzle tables; `EmailSequence`, `NewEmailSequence`, `EmailSequenceStep`, `NewEmailSequenceStep` inferred types; `EmailSequenceTriggerType` (`"lead_created" | "stage_entered"`) and `ScheduledEmailKind` (`"sequence" | "broadcast"`) types in `db/types.ts`. `scheduledEmails` gains `kind`, `stepId`, `attempt` columns. The unique index on `scheduledEmails` changes from `(leadId, sequenceStep)` to `(leadId, sequenceStep, attempt)`.
- Consumes: nothing (first task).

Every later task imports these tables/types, so get the shape right here. Note the deliberate Phase 1 scoping decision: `triggerType`/`triggerSource`/`triggerStage` are all part of the schema now (so this table is never migrated twice for the same concern), but Phase 1's app code only ever writes `triggerType: "lead_created"` and leaves `triggerStage` null — Phase 3 is what adds the `stage_entered` behavior and its UI.

- [ ] **Step 1: Add the new types to `db/types.ts`**

Add these two exports (anywhere after the existing type definitions, e.g. right after `ScheduledEmailStatus`):

```ts
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
```

- [ ] **Step 2: Add `emailSequences` and `emailSequenceSteps` tables to `db/schema.ts`**

First, update the type-only import at the top of the file to include the two new types:

```ts
import type {
  ApplicationQuestion,
  CronRunStats,
  CronRunStatus,
  EmailSequenceTriggerType,
  LeadAnswers,
  ScheduledEmailKind,
  ScheduledEmailStatus,
  UserRole,
} from "./types";
```

Then add the two new tables. Insert them directly after the `notes` table definition and before `scheduledEmails`:

```ts
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
    heading: text("heading").notNull(),
    /** Plain paragraphs, rendered one per <Text> block — see
     *  lib/email/render.ts. Becomes a Tiptap EmailDoc in Phase 2. */
    paragraphs: jsonb("paragraphs").$type<string[]>().notNull(),
    ...timestamps,
  },
  (t) => [index("email_sequence_steps_sequence_id_position_idx").on(t.sequenceId, t.position)],
);
```

Now modify the existing `scheduledEmails` table: add three columns and rename the unique index. Replace this block:

```ts
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
```

with:

```ts
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
```

Finally, add inferred types next to the existing ones (near `export type ScheduledEmail = ...`):

```ts
export type EmailSequence = typeof emailSequences.$inferSelect;
export type NewEmailSequence = typeof emailSequences.$inferInsert;

export type EmailSequenceStep = typeof emailSequenceSteps.$inferSelect;
export type NewEmailSequenceStep = typeof emailSequenceSteps.$inferInsert;
```

- [ ] **Step 3: Extend the tenant-scoping test**

In `__tests__/tenant-scoping.test.ts`, add `emailSequences` and `emailSequenceSteps` to the import from `@/db/schema`, and add two new `it` blocks inside the `describe("ownedBy", ...)` block (after the existing `scheduledEmails` one):

```ts
  it("emits a trainer_id predicate for emailSequences", () => {
    const query = qb.select().from(emailSequences).where(ownedBy(emailSequences, scope));
    const { sql, params } = query.toSQL();
    expect(sql).toContain('"trainer_id" =');
    expect(params).toContain(scope.trainerId);
  });

  it("emits a trainer_id predicate for emailSequenceSteps", () => {
    const query = qb.select().from(emailSequenceSteps).where(ownedBy(emailSequenceSteps, scope));
    const { sql, params } = query.toSQL();
    expect(sql).toContain('"trainer_id" =');
    expect(params).toContain(scope.trainerId);
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/tenant-scoping.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Generate and apply the migration**

Run: `npx drizzle-kit generate`
Expected: a new file under `db/migrations/` creating `email_sequences`, `email_sequence_steps`, adding `kind`/`step_id`/`attempt` to `scheduled_emails`, dropping `scheduled_emails_lead_id_sequence_step_unique`, and creating `scheduled_emails_lead_id_sequence_step_attempt_unique`.

Run: `npm run db:migrate`
Expected: migration applies cleanly against the dev database.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no other files reference the new tables/columns yet, so this should be clean).

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts db/types.ts db/migrations __tests__/tenant-scoping.test.ts
git commit -m "feat(db): add email_sequences/email_sequence_steps tables and scheduled_emails kind/stepId/attempt columns"
```

---

## Task 2: Variable substitution helper

**Files:**
- Create: `lib/email/variables.ts`
- Test: `__tests__/email-variables.test.ts`

**Interfaces:**
- Produces: `SequenceRenderContext` (`{ leadName: string | null; trainerName: string }`) and `substituteVariables(text: string, ctx: SequenceRenderContext): string`, both exported from `lib/email/variables.ts`.
- Consumes: nothing.

This is the Phase 1 stand-in for personalization: a trainer writes `{{ime}}`/`{{trener}}` literally in their step text, and this function replaces them at send time. A closed, fixed token set — not a general template engine — so there's no injection surface.

- [ ] **Step 1: Write the failing test**

Create `__tests__/email-variables.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { substituteVariables } from "@/lib/email/variables";

describe("substituteVariables", () => {
  it("replaces {{ime}} with the lead's name", () => {
    expect(substituteVariables("Pozdravljeni {{ime}}!", { leadName: "Ana", trainerName: "Janez" })).toBe(
      "Pozdravljeni Ana!",
    );
  });

  it("replaces {{trener}} with the trainer's name", () => {
    expect(substituteVariables("Lep pozdrav, {{trener}}", { leadName: "Ana", trainerName: "Janez" })).toBe(
      "Lep pozdrav, Janez",
    );
  });

  it("replaces {{ime}} with an empty string when the lead has no name", () => {
    expect(substituteVariables("Pozdravljeni {{ime}}!", { leadName: null, trainerName: "Janez" })).toBe(
      "Pozdravljeni !",
    );
  });

  it("replaces every occurrence, not just the first", () => {
    expect(substituteVariables("{{ime}}, {{ime}}!", { leadName: "Ana", trainerName: "Janez" })).toBe("Ana, Ana!");
  });

  it("leaves text with no tokens unchanged", () => {
    expect(substituteVariables("Navadno besedilo brez oklepajev.", { leadName: "Ana", trainerName: "Janez" })).toBe(
      "Navadno besedilo brez oklepajev.",
    );
  });

  it("leaves an unrecognized {{token}} untouched", () => {
    expect(substituteVariables("{{neznano}}", { leadName: "Ana", trainerName: "Janez" })).toBe("{{neznano}}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/email-variables.test.ts`
Expected: FAIL — `lib/email/variables.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/email/variables.ts`**

```ts
export interface SequenceRenderContext {
  leadName: string | null;
  trainerName: string;
}

/**
 * The trainer's two supported placeholder tokens, in the order they're
 * applied. A fixed, closed set — not a generic template engine — so a
 * trainer typing literal `{{` in prose can't accidentally reference
 * anything we didn't intend to expose. Phase 2's rich-text `variable` node
 * (lib/validation/email-doc.ts) replaces this same closed set with a proper
 * editor affordance instead of raw token typing.
 */
const VARIABLE_RESOLVERS: Record<string, (ctx: SequenceRenderContext) => string> = {
  "{{ime}}": (ctx) => ctx.leadName ?? "",
  "{{trener}}": (ctx) => ctx.trainerName,
};

export function substituteVariables(text: string, ctx: SequenceRenderContext): string {
  let result = text;
  for (const [token, resolve] of Object.entries(VARIABLE_RESOLVERS)) {
    result = result.split(token).join(resolve(ctx));
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/email-variables.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add lib/email/variables.ts __tests__/email-variables.test.ts
git commit -m "feat(email): add {{ime}}/{{trener}} variable substitution for sequence steps"
```

---

## Task 3: Validation schemas and caps

**Files:**
- Modify: `lib/email/constants.ts`
- Create: `lib/validation/email-sequences.ts`
- Test: `__tests__/email-sequences-validation.test.ts`

**Interfaces:**
- Produces: `MAX_SEQUENCES_PER_TRAINER`, `MAX_STEPS_PER_SEQUENCE` (from `lib/email/constants.ts`); `emailSequenceStepSchema`, `emailSequenceFormSchema`, `EmailSequenceStepInput`, `EmailSequenceFormInput` (from `lib/validation/email-sequences.ts`).
- Consumes: `MAX_SCHEDULE_DAYS` (existing, `lib/email/constants.ts`).

- [ ] **Step 1: Add the two caps to `lib/email/constants.ts`**

Add at the end of the file:

```ts

/** Product cap, not a technical one — keeps the sequence list scannable and
 *  bounds how many Resend schedule calls one lead enrollment can fan out
 *  into. Enforced in db/queries/email-sequences.ts's createEmailSequence. */
export const MAX_SEQUENCES_PER_TRAINER = 5;

/** Same rationale as MAX_SEQUENCES_PER_TRAINER, per sequence. */
export const MAX_STEPS_PER_SEQUENCE = 15;
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/email-sequences-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { emailSequenceFormSchema, emailSequenceStepSchema } from "@/lib/validation/email-sequences";

const validStep = {
  subject: "Prejeli smo vašo prijavo",
  heading: "Hvala za prijavo!",
  paragraphs: ["Prvi odstavek.", "Drugi odstavek."],
  dayOffset: 0,
};

describe("emailSequenceStepSchema", () => {
  it("accepts a well-formed step", () => {
    expect(emailSequenceStepSchema.safeParse(validStep).success).toBe(true);
  });

  it("accepts an optional id (an existing step being edited)", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, id: crypto.randomUUID() });
    expect(result.success).toBe(true);
  });

  it("rejects an empty paragraphs array", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, paragraphs: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a negative dayOffset", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, dayOffset: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a dayOffset beyond Resend's scheduling ceiling", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, dayOffset: MAX_SCHEDULE_DAYS + 1 });
    expect(result.success).toBe(false);
  });

  it("accepts a dayOffset exactly at the ceiling", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, dayOffset: MAX_SCHEDULE_DAYS });
    expect(result.success).toBe(true);
  });

  it("rejects an empty subject", () => {
    const result = emailSequenceStepSchema.safeParse({ ...validStep, subject: "" });
    expect(result.success).toBe(false);
  });
});

describe("emailSequenceFormSchema", () => {
  const validForm = { name: "Prijave", triggerSource: "application" as const, enabled: true, steps: [validStep] };

  it("accepts a well-formed sequence", () => {
    expect(emailSequenceFormSchema.safeParse(validForm).success).toBe(true);
  });

  it("accepts a null triggerSource (any source)", () => {
    expect(emailSequenceFormSchema.safeParse({ ...validForm, triggerSource: null }).success).toBe(true);
  });

  it("rejects an unknown triggerSource", () => {
    const result = emailSequenceFormSchema.safeParse({ ...validForm, triggerSource: "referral" });
    expect(result.success).toBe(false);
  });

  it("rejects zero steps", () => {
    const result = emailSequenceFormSchema.safeParse({ ...validForm, steps: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than MAX_STEPS_PER_SEQUENCE steps", () => {
    const steps = Array.from({ length: MAX_STEPS_PER_SEQUENCE + 1 }, () => validStep);
    const result = emailSequenceFormSchema.safeParse({ ...validForm, steps });
    expect(result.success).toBe(false);
  });

  it("accepts exactly MAX_STEPS_PER_SEQUENCE steps", () => {
    const steps = Array.from({ length: MAX_STEPS_PER_SEQUENCE }, () => validStep);
    const result = emailSequenceFormSchema.safeParse({ ...validForm, steps });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = emailSequenceFormSchema.safeParse({ ...validForm, name: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/email-sequences-validation.test.ts`
Expected: FAIL — `lib/validation/email-sequences.ts` does not exist yet.

- [ ] **Step 4: Implement `lib/validation/email-sequences.ts`**

```ts
import { z } from "zod";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";

/**
 * `id` is present when the trainer is editing a step that already exists in
 * the DB (echoed back by the client), and absent for a step just added in
 * this edit session — db/queries/email-sequences.ts's updateEmailSequence
 * uses its presence/absence to decide "update in place" vs. "insert new".
 */
export const emailSequenceStepSchema = z.object({
  id: z.uuid().optional(),
  subject: z.string().trim().min(1, { error: "Zadeva je obvezna." }).max(200),
  heading: z.string().trim().min(1, { error: "Naslov je obvezen." }).max(200),
  paragraphs: z
    .array(z.string().trim().min(1).max(2000))
    .min(1, { error: "Dodajte vsaj en odstavek besedila." })
    .max(20),
  dayOffset: z
    .number()
    .int()
    .min(0, { error: "Dan mora biti 0 ali več." })
    .max(MAX_SCHEDULE_DAYS, { error: `Dan ne sme biti večji od ${MAX_SCHEDULE_DAYS} (Resendova omejitev).` }),
});

export const emailSequenceFormSchema = z.object({
  name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
  /** Null = enrolls a lead regardless of source. */
  triggerSource: z.enum(["application", "lead_magnet"]).nullable(),
  enabled: z.boolean(),
  steps: z
    .array(emailSequenceStepSchema)
    .min(1, { error: "Sekvenca potrebuje vsaj en korak." })
    .max(MAX_STEPS_PER_SEQUENCE, { error: `Sekvenca ima lahko največ ${MAX_STEPS_PER_SEQUENCE} korakov.` }),
});

export type EmailSequenceStepInput = z.infer<typeof emailSequenceStepSchema>;
export type EmailSequenceFormInput = z.infer<typeof emailSequenceFormSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/email-sequences-validation.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add lib/email/constants.ts lib/validation/email-sequences.ts __tests__/email-sequences-validation.test.ts
git commit -m "feat(validation): add email sequence/step schemas and MAX_SEQUENCES_PER_TRAINER/MAX_STEPS_PER_SEQUENCE caps"
```

---

## Task 4: `db/queries/email-sequences.ts`

**Files:**
- Create: `db/queries/email-sequences.ts`
- Test: `__tests__/email-sequences-queries.test.ts`

**Interfaces:**
- Consumes: `emailSequences`, `emailSequenceSteps` (Task 1); `emailSequenceFormSchema`'s inferred type `EmailSequenceFormInput` (Task 3); `MAX_SEQUENCES_PER_TRAINER` (Task 3); `scoped`/`ownedBy`/`TrainerScope` (`lib/tenant.ts`, existing).
- Produces (all take a `TrainerScope` first, per this repo's tenant-isolation convention):
  - `SequenceLimitExceededError` (class)
  - `EmailSequenceSummary` (`EmailSequence & { stepCount: number }`), `EmailSequenceWithSteps` (`{ sequence: EmailSequence; steps: EmailSequenceStep[] }`) types
  - `listEmailSequencesForTrainer(scope): Promise<EmailSequenceSummary[]>`
  - `getEmailSequenceWithSteps(scope, sequenceId): Promise<EmailSequenceWithSteps | null>`
  - `createEmailSequence(scope, input: EmailSequenceFormInput): Promise<EmailSequence>` — throws `SequenceLimitExceededError` at the cap
  - `updateEmailSequence(scope, sequenceId, input: EmailSequenceFormInput): Promise<EmailSequence | null>`
  - `setEmailSequenceEnabled(scope, sequenceId, enabled): Promise<boolean>`
  - `listEnabledSequencesForLeadCreated(scope, source: LeadSource): Promise<EmailSequenceWithSteps[]>` — Task 8 (`lib/email/enroll.ts`) depends on this exact name/shape
  - `getEmailSequenceStepForSend(scope, stepId): Promise<EmailSequenceStep | null>` — Task 8 (`lib/email/schedule.ts`'s retry path) depends on this

- [ ] **Step 1: Write the failing tests**

Create `__tests__/email-sequences-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const selectCountMock = vi.fn();
const insertSequenceReturningMock = vi.fn();
const insertStepsMock = vi.fn();
const updateSequenceReturningMock = vi.fn();
const selectExistingStepsMock = vi.fn();
const deleteStepsMock = vi.fn();
const updateStepMock = vi.fn();
const insertStepMock = vi.fn();

// A tiny, order-sensitive queue: each call to db.select() consumes the next
// entry, so a test can script "first select returns the count, second
// returns existing steps" without a single shared mock trying to do both.
let selectQueue: Array<() => unknown> = [];

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const next = selectQueue.shift();
      const resolved = next ? next() : undefined;
      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(resolved),
            groupBy: () => Promise.resolve(resolved),
            limit: () => Promise.resolve(resolved),
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
          }),
        }),
      };
    },
    insert: (table: { _isSteps?: boolean }) => ({
      values: (values: unknown) => {
        if (Array.isArray(values)) {
          insertStepsMock(values);
          return Promise.resolve(undefined);
        }
        insertStepMock(values);
        return {
          returning: () => insertSequenceReturningMock(),
        };
      },
    }),
    update: () => ({
      set: (patch: unknown) => ({
        where: () => ({
          returning: () => updateSequenceReturningMock(patch),
        }),
      }),
    }),
    delete: () => ({
      where: () => deleteStepsMock(),
    }),
  },
}));

import {
  createEmailSequence,
  SequenceLimitExceededError,
  updateEmailSequence,
} from "@/db/queries/email-sequences";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "operator_cli");

const validInput = {
  name: "Prijave",
  triggerSource: "application" as const,
  enabled: true,
  steps: [
    { subject: "Zadeva", heading: "Naslov", paragraphs: ["Odstavek."], dayOffset: 0 },
    { subject: "Zadeva 2", heading: "Naslov 2", paragraphs: ["Odstavek 2."], dayOffset: 2 },
  ],
};

beforeEach(() => {
  selectQueue = [];
  insertSequenceReturningMock.mockReset();
  insertStepsMock.mockReset();
  updateSequenceReturningMock.mockReset();
  deleteStepsMock.mockReset();
  updateStepMock.mockReset();
  insertStepMock.mockReset();
});

describe("createEmailSequence", () => {
  it("throws SequenceLimitExceededError at the cap", async () => {
    selectQueue.push(() => [{ total: MAX_SEQUENCES_PER_TRAINER }]);

    await expect(createEmailSequence(scope, validInput)).rejects.toThrow(SequenceLimitExceededError);
  });

  it("inserts the sequence and its steps with sequential positions when under the cap", async () => {
    selectQueue.push(() => [{ total: 0 }]);
    insertSequenceReturningMock.mockResolvedValue([{ id: "seq-1", name: "Prijave" }]);

    await createEmailSequence(scope, validInput);

    expect(insertStepsMock).toHaveBeenCalledWith([
      expect.objectContaining({ sequenceId: "seq-1", position: 0, dayOffset: 0 }),
      expect.objectContaining({ sequenceId: "seq-1", position: 1, dayOffset: 2 }),
    ]);
  });
});

describe("updateEmailSequence", () => {
  it("returns null when the sequence isn't found (wrong id or wrong trainer)", async () => {
    updateSequenceReturningMock.mockResolvedValue([]);

    const result = await updateEmailSequence(scope, "missing-seq", validInput);

    expect(result).toBeNull();
  });

  it("deletes steps that are no longer present in the input", async () => {
    updateSequenceReturningMock.mockResolvedValue([{ id: "seq-1" }]);
    selectQueue.push(() => [{ id: "step-old-1" }, { id: "step-old-2" }]);

    await updateEmailSequence(scope, "seq-1", validInput); // input carries no ids -> both are "removed"

    expect(deleteStepsMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/email-sequences-queries.test.ts`
Expected: FAIL — `db/queries/email-sequences.ts` does not exist yet.

- [ ] **Step 3: Implement `db/queries/email-sequences.ts`**

```ts
import { asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { emailSequences, emailSequenceSteps, type EmailSequence, type EmailSequenceStep } from "@/db/schema";
import type { LeadSource } from "@/db/schema";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { ownedBy, scoped, type TrainerScope } from "@/lib/tenant";
import type { EmailSequenceFormInput } from "@/lib/validation/email-sequences";

export class SequenceLimitExceededError extends Error {
  constructor() {
    super(`A trainer may have at most ${MAX_SEQUENCES_PER_TRAINER} sequences.`);
    this.name = "SequenceLimitExceededError";
  }
}

export interface EmailSequenceSummary extends EmailSequence {
  stepCount: number;
}

export interface EmailSequenceWithSteps {
  sequence: EmailSequence;
  steps: EmailSequenceStep[];
}

/** Powers the /emails/sequences list page. */
export async function listEmailSequencesForTrainer(scope: TrainerScope): Promise<EmailSequenceSummary[]> {
  const sequences = await db
    .select()
    .from(emailSequences)
    .where(ownedBy(emailSequences, scope))
    .orderBy(desc(emailSequences.createdAt));

  if (sequences.length === 0) return [];

  const counts = await db
    .select({ sequenceId: emailSequenceSteps.sequenceId, total: count() })
    .from(emailSequenceSteps)
    .where(ownedBy(emailSequenceSteps, scope))
    .groupBy(emailSequenceSteps.sequenceId);
  const countBySequence = new Map(counts.map((c) => [c.sequenceId, c.total]));

  return sequences.map((sequence) => ({ ...sequence, stepCount: countBySequence.get(sequence.id) ?? 0 }));
}

/** Powers the /emails/sequences/[id] edit page. Null if not found or owned
 *  by a different trainer — the page treats both identically (notFound()). */
export async function getEmailSequenceWithSteps(
  scope: TrainerScope,
  sequenceId: string,
): Promise<EmailSequenceWithSteps | null> {
  const [sequence] = await db
    .select()
    .from(emailSequences)
    .where(scoped(emailSequences, scope, eq(emailSequences.id, sequenceId)))
    .limit(1);
  if (!sequence) return null;

  const steps = await db
    .select()
    .from(emailSequenceSteps)
    .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.sequenceId, sequenceId)))
    .orderBy(asc(emailSequenceSteps.position));

  return { sequence, steps };
}

/** Throws SequenceLimitExceededError at MAX_SEQUENCES_PER_TRAINER — checked
 *  here, not only in the UI, since the UI's disabled "new sequence" button
 *  is a courtesy, not the enforcement boundary. */
export async function createEmailSequence(
  scope: TrainerScope,
  input: EmailSequenceFormInput,
): Promise<EmailSequence> {
  const [{ total }] = await db.select({ total: count() }).from(emailSequences).where(ownedBy(emailSequences, scope));
  if (total >= MAX_SEQUENCES_PER_TRAINER) {
    throw new SequenceLimitExceededError();
  }

  const [sequence] = await db
    .insert(emailSequences)
    .values({
      trainerId: scope.trainerId,
      name: input.name,
      triggerType: "lead_created",
      triggerSource: input.triggerSource,
      enabled: input.enabled,
    })
    .returning();

  await db.insert(emailSequenceSteps).values(
    input.steps.map((step, position) => ({
      trainerId: scope.trainerId,
      sequenceId: sequence.id,
      position,
      dayOffset: step.dayOffset,
      subject: step.subject,
      heading: step.heading,
      paragraphs: step.paragraphs,
    })),
  );

  return sequence;
}

/**
 * Full replace of the sequence's own fields, plus a diff of its steps: a
 * step with a matching existing `id` is updated in place (so
 * scheduled_emails.stepId links for already-scheduled sends stay valid), a
 * step with no `id` is a new insert, and any existing step absent from the
 * input is deleted. Sequential (not db.batch'd or transactional) — this
 * table has no external side effect (no Resend call), so a partial failure
 * here is a data inconsistency to retry, not a lost email; see db/index.ts's
 * documented tolerance for the neon-http driver's lack of transactions.
 */
export async function updateEmailSequence(
  scope: TrainerScope,
  sequenceId: string,
  input: EmailSequenceFormInput,
): Promise<EmailSequence | null> {
  const [updatedSequence] = await db
    .update(emailSequences)
    .set({ name: input.name, triggerSource: input.triggerSource, enabled: input.enabled })
    .where(scoped(emailSequences, scope, eq(emailSequences.id, sequenceId)))
    .returning();
  if (!updatedSequence) return null;

  const existingSteps = await db
    .select({ id: emailSequenceSteps.id })
    .from(emailSequenceSteps)
    .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.sequenceId, sequenceId)));
  const existingIds = new Set(existingSteps.map((s) => s.id));
  const keptIds = new Set(input.steps.filter((s) => s.id).map((s) => s.id as string));

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    await db
      .delete(emailSequenceSteps)
      .where(scoped(emailSequenceSteps, scope, inArray(emailSequenceSteps.id, removedIds)));
  }

  for (const [position, step] of input.steps.entries()) {
    if (step.id && existingIds.has(step.id)) {
      await db
        .update(emailSequenceSteps)
        .set({
          position,
          dayOffset: step.dayOffset,
          subject: step.subject,
          heading: step.heading,
          paragraphs: step.paragraphs,
        })
        .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.id, step.id)));
    } else {
      await db.insert(emailSequenceSteps).values({
        trainerId: scope.trainerId,
        sequenceId,
        position,
        dayOffset: step.dayOffset,
        subject: step.subject,
        heading: step.heading,
        paragraphs: step.paragraphs,
      });
    }
  }

  return updatedSequence;
}

/** The trainer's "vklopi/izklopi" toggle — does not touch steps. Returns
 *  whether a row was actually found and updated. */
export async function setEmailSequenceEnabled(
  scope: TrainerScope,
  sequenceId: string,
  enabled: boolean,
): Promise<boolean> {
  const rows = await db
    .update(emailSequences)
    .set({ enabled })
    .where(scoped(emailSequences, scope, eq(emailSequences.id, sequenceId)))
    .returning({ id: emailSequences.id });
  return rows.length > 0;
}

/**
 * Every enabled, lead_created-triggered sequence that matches this lead's
 * source (or targets any source) — what lib/email/enroll.ts's
 * enrollLeadOnCreate fans out over. A trainer can have more than one
 * matching sequence (e.g. one scoped to "application" and one with
 * triggerSource null); both get enrolled.
 */
export async function listEnabledSequencesForLeadCreated(
  scope: TrainerScope,
  source: LeadSource,
): Promise<EmailSequenceWithSteps[]> {
  const sequences = await db
    .select()
    .from(emailSequences)
    .where(
      scoped(
        emailSequences,
        scope,
        eq(emailSequences.enabled, true),
        eq(emailSequences.triggerType, "lead_created"),
        or(isNull(emailSequences.triggerSource), eq(emailSequences.triggerSource, source)),
      ),
    );
  if (sequences.length === 0) return [];

  const steps = await db
    .select()
    .from(emailSequenceSteps)
    .where(
      scoped(
        emailSequenceSteps,
        scope,
        inArray(
          emailSequenceSteps.sequenceId,
          sequences.map((s) => s.id),
        ),
      ),
    )
    .orderBy(asc(emailSequenceSteps.position));

  const stepsBySequence = new Map<string, EmailSequenceStep[]>();
  for (const step of steps) {
    const list = stepsBySequence.get(step.sequenceId) ?? [];
    list.push(step);
    stepsBySequence.set(step.sequenceId, list);
  }

  return sequences.map((sequence) => ({ sequence, steps: stepsBySequence.get(sequence.id) ?? [] }));
}

/** Scoped lookup used by lib/email/schedule.ts's retryPendingScheduledEmail
 *  — a pending row only knows its stepId, not which trainer's scope minted
 *  it, so the caller must already hold the right scope before calling this. */
export async function getEmailSequenceStepForSend(
  scope: TrainerScope,
  stepId: string,
): Promise<EmailSequenceStep | null> {
  const [step] = await db
    .select()
    .from(emailSequenceSteps)
    .where(scoped(emailSequenceSteps, scope, eq(emailSequenceSteps.id, stepId)))
    .limit(1);
  return step ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/email-sequences-queries.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/queries/email-sequences.ts __tests__/email-sequences-queries.test.ts
git commit -m "feat(db): add email-sequences query module (CRUD, cap enforcement, lead-created matching)"
```

---

## Task 5: `scheduled_emails` reserve path — `kind`/`stepId`/attempt-aware unique index

**Files:**
- Modify: `db/queries/scheduled-emails.ts`
- Test: `__tests__/scheduled-emails-reserve.test.ts` (create)

**Interfaces:**
- Consumes: `kind`/`stepId`/`attempt` columns (Task 1).
- Produces: `ReserveScheduledEmailInput` gains `stepId: string | null` and `kind: ScheduledEmailKind`; `reserveScheduledEmails`'s `onConflictDoNothing` target becomes `[leadId, sequenceStep, attempt]`. Task 8 (`lib/email/enroll.ts`) calls this with the new shape.

- [ ] **Step 1: Write the failing test**

Create `__tests__/scheduled-emails-reserve.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const returningMock = vi.fn();
const onConflictDoNothingMock = vi.fn(() => ({ returning: returningMock }));
const valuesMock = vi.fn(() => ({ onConflictDoNothing: onConflictDoNothingMock }));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: valuesMock }),
  },
}));

import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  returningMock.mockReset();
  onConflictDoNothingMock.mockClear();
  valuesMock.mockClear();
});

describe("reserveScheduledEmails", () => {
  it("targets the (leadId, sequenceStep, attempt) unique index on conflict", async () => {
    returningMock.mockResolvedValue([]);

    await reserveScheduledEmails(scope, [
      { leadId: "lead-1", sequenceStep: "step-1", stepId: "step-1", kind: "sequence", scheduledFor: new Date() },
    ]);

    const target = onConflictDoNothingMock.mock.calls[0][0].target;
    expect(target).toHaveLength(3);
  });

  it("passes kind and stepId through into the inserted row", async () => {
    returningMock.mockResolvedValue([]);

    await reserveScheduledEmails(scope, [
      { leadId: "lead-1", sequenceStep: "step-1", stepId: "step-1", kind: "sequence", scheduledFor: new Date() },
    ]);

    const values = valuesMock.mock.calls[0][0];
    expect(values[0]).toMatchObject({ stepId: "step-1", kind: "sequence" });
  });

  it("returns an empty array without querying when given no inputs", async () => {
    const result = await reserveScheduledEmails(scope, []);
    expect(result).toEqual([]);
    expect(valuesMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/scheduled-emails-reserve.test.ts`
Expected: FAIL — current `ReserveScheduledEmailInput` has no `stepId`/`kind`, and the conflict target is only 2 columns.

- [ ] **Step 3: Update `db/queries/scheduled-emails.ts`**

Replace the `ReserveScheduledEmailInput` interface and `reserveScheduledEmails` function with:

```ts
export interface ReserveScheduledEmailInput {
  leadId: string;
  sequenceStep: string;
  /** Typed step link — see scheduledEmails.stepId's doc in db/schema.ts. */
  stepId: string | null;
  kind: ScheduledEmailKind;
  scheduledFor: Date;
}

/**
 * Reserve step of the scheduling protocol — see lib/email/schedule.ts.
 * onConflictDoNothing on (leadId, sequenceStep, attempt) makes this
 * idempotent: only rows that did not already exist are returned, so a
 * caller (including the cron reconciler) can call this blindly and safely.
 * `attempt` is never passed here — it defaults to 1 at the DB level; Phase 4
 * is what re-enrolls with attempt > 1.
 */
export async function reserveScheduledEmails(
  scope: TrainerScope,
  inputs: ReserveScheduledEmailInput[],
): Promise<ScheduledEmail[]> {
  if (inputs.length === 0) return [];
  const values: NewScheduledEmail[] = inputs.map((input) => ({
    trainerId: scope.trainerId,
    leadId: input.leadId,
    sequenceStep: input.sequenceStep,
    stepId: input.stepId,
    kind: input.kind,
    scheduledFor: input.scheduledFor,
    status: "pending",
  }));
  return db
    .insert(scheduledEmails)
    .values(values)
    .onConflictDoNothing({
      target: [scheduledEmails.leadId, scheduledEmails.sequenceStep, scheduledEmails.attempt],
    })
    .returning();
}
```

Add `ScheduledEmailKind` to the existing `import type { ScheduledEmailStatus } from "@/db/types";` line at the top of the file (`import type { ScheduledEmailKind, ScheduledEmailStatus } from "@/db/types";`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/scheduled-emails-reserve.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Run the full existing scheduled-emails test to check for regressions**

Run: `npx vitest run __tests__/scheduled-emails-list.test.ts`
Expected: PASS unchanged (this task didn't touch `listScheduledEmailsForTrainer`).

- [ ] **Step 6: Commit**

```bash
git add db/queries/scheduled-emails.ts __tests__/scheduled-emails-reserve.test.ts
git commit -m "feat(db): make reserveScheduledEmails kind/stepId-aware and target the new 3-column unique index"
```

---

## Task 6: Default sequence templates (seed data)

**Files:**
- Create: `lib/email/default-sequences.ts`
- Test: `__tests__/default-sequences.test.ts`

**Interfaces:**
- Produces: `DefaultSequenceStep` (`{ dayOffset: number; subject: string; heading: string; paragraphs: string[] }`), `DefaultSequence` (`{ name: string; triggerSource: LeadSource; steps: DefaultSequenceStep[] }`), `DEFAULT_SEQUENCES: DefaultSequence[]`.
- Consumes: `LeadSource` (existing, `db/schema.ts`); `MAX_SCHEDULE_DAYS` (existing).

This is the seed content every new trainer starts with — content ported from the old `lib/email/sequences.ts` + `lib/email/copy.ts`, with `${ctx.trainerName}` interpolations rewritten as the literal `{{trener}}` token (Task 2). This is the last task that references the old hardcoded system's *content*; Task 7 deletes the files themselves.

- [ ] **Step 1: Write the failing test**

Create `__tests__/default-sequences.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SEQUENCES } from "@/lib/email/default-sequences";
import { MAX_SCHEDULE_DAYS } from "@/lib/email/constants";

describe("DEFAULT_SEQUENCES", () => {
  it("defines exactly one sequence per lead source", () => {
    expect(DEFAULT_SEQUENCES.map((s) => s.triggerSource).sort()).toEqual(["application", "lead_magnet"]);
  });

  it("keeps every dayOffset within Resend's scheduling ceiling", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      for (const step of sequence.steps) {
        expect(step.dayOffset).toBeGreaterThanOrEqual(0);
        expect(step.dayOffset).toBeLessThanOrEqual(MAX_SCHEDULE_DAYS);
      }
    }
  });

  it("gives every sequence at least one step", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      expect(sequence.steps.length).toBeGreaterThan(0);
    }
  });

  it("gives every step a non-empty subject, heading, and at least one paragraph", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      for (const step of sequence.steps) {
        expect(step.subject.length).toBeGreaterThan(0);
        expect(step.heading.length).toBeGreaterThan(0);
        expect(step.paragraphs.length).toBeGreaterThan(0);
        for (const paragraph of step.paragraphs) {
          expect(paragraph.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gives every sequence a non-empty name", () => {
    for (const sequence of DEFAULT_SEQUENCES) {
      expect(sequence.name.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/default-sequences.test.ts`
Expected: FAIL — `lib/email/default-sequences.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/email/default-sequences.ts`**

```ts
import type { LeadSource } from "@/db/schema";

export interface DefaultSequenceStep {
  dayOffset: number;
  subject: string;
  heading: string;
  paragraphs: string[];
}

export interface DefaultSequence {
  name: string;
  triggerSource: LeadSource;
  steps: DefaultSequenceStep[];
}

/**
 * Starter content every new trainer gets (see lib/email/seed-defaults.ts),
 * ported from the pre-Phase-1 hardcoded lib/email/sequences.ts +
 * lib/email/copy.ts (deleted in Task 7) — same two sequences, same steps,
 * same day offsets. `${ctx.trainerName}` interpolations become the literal
 * `{{trener}}` token (see lib/email/variables.ts); the old name-conditional
 * headings ("Hvala, Ana!" vs. "Hvala!") are flattened to a single
 * unconditional heading, since Phase 1's substitution has no branching —
 * the trainer is expected to edit this starter copy to fit their voice.
 */
export const DEFAULT_SEQUENCES: DefaultSequence[] = [
  {
    name: "Prijave",
    triggerSource: "application",
    steps: [
      {
        dayOffset: 0,
        subject: "Prejeli smo vašo prijavo",
        heading: "Hvala za prijavo!",
        paragraphs: [
          "Vašo prijavo smo uspešno prejeli. {{trener}} si jo bo kmalu ogledal in vas kontaktiral.",
          "V naslednjem sporočilu vas čaka povezava za rezervacijo termina za klic.",
        ],
      },
      {
        dayOffset: 0,
        subject: "Rezervirajte termin za klic",
        heading: "Rezervirajte termin za klic",
        paragraphs: [
          "{{trener}} bi se rad z vami slišal in spoznal vaše cilje.",
          "Odgovorite na to sporočilo ali nas pokličite, da dogovorimo termin.",
        ],
      },
      {
        dayOffset: 2,
        subject: "Še vedno vas zanima?",
        heading: "Še vedno vas zanima?",
        paragraphs: [
          "Preteklo je nekaj dni od vaše prijave in {{trener}} vas še vedno rad sliši.",
          "Če vas zanima nadaljevanje, se javite — z veseljem odgovorimo na vsa vprašanja.",
        ],
      },
      {
        dayOffset: 5,
        subject: "Zadnja priložnost za termin",
        heading: "Zadnja priložnost za termin",
        paragraphs: [
          "To je zadnje opozorilo iz naše prijavne sekvence. {{trener}} bi rad slišal od vas.",
          "Če je čas neprimeren, ni problema — vedno se lahko oglasite kasneje.",
        ],
      },
    ],
  },
  {
    name: "Brezplačni vodič",
    triggerSource: "lead_magnet",
    steps: [
      {
        dayOffset: 0,
        subject: "Vaš brezplačni vodič",
        heading: "Tukaj je vaš brezplačni vodič",
        paragraphs: [
          "Hvala za vaš interes! {{trener}} vam je pripravil brezplačni vodič — najdete ga na povezavi spodaj.",
          "V naslednjih dneh boste prejeli še nekaj koristnih nasvetov.",
        ],
      },
      {
        dayOffset: 2,
        subject: "Kako začeti",
        heading: "Kako začeti",
        paragraphs: [
          "Najpogostejša napaka na začetku je, da hočemo narediti preveč naenkrat.",
          "Majhni, dosledni koraki prinesejo boljše rezultate kot popoln načrt, ki ga ne vzdržimo.",
        ],
      },
      {
        dayOffset: 5,
        subject: "Pogosta napaka pri treniranju",
        heading: "Pogosta napaka pri treniranju",
        paragraphs: [
          "Veliko ljudi preneha, ker pričakuje prehitre rezultate.",
          "Napredek se najbolje meri čez tedne, ne dneve.",
        ],
      },
      {
        dayOffset: 9,
        subject: "Doslednost je pomembnejša od popolnosti",
        heading: "Doslednost je pomembnejša od popolnosti",
        paragraphs: [
          "Ni vam treba biti popolni vsak dan — dovolj je, da se držite načrta večino časa.",
          "Če želite osebno vodstvo pri tem, smo tu.",
        ],
      },
      {
        dayOffset: 14,
        subject: "Pripravljeni na naslednji korak?",
        heading: "Pripravljeni na naslednji korak?",
        paragraphs: [
          "Če razmišljate o osebnem vodstvu, se {{trener}} z veseljem pogovori z vami.",
          "Odgovorite na to sporočilo, da se dogovorimo za kratek klic.",
        ],
      },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/default-sequences.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/email/default-sequences.ts __tests__/default-sequences.test.ts
git commit -m "feat(email): port the hardcoded sequences into DEFAULT_SEQUENCES seed data"
```

---

## Task 7: Rewrite send-time rendering; retire the hardcoded template system

**Files:**
- Modify: `lib/email/render.ts`
- Modify: `lib/email/templates/sequence-email.tsx`
- Delete: `lib/email/sequences.ts`
- Delete: `lib/email/copy.ts`
- Delete: `__tests__/sequences.test.ts` (superseded by Task 6's `default-sequences.test.ts`)

**Interfaces:**
- Consumes: `SequenceRenderContext`, `substituteVariables` (Task 2).
- Produces: `RenderableStep` (`{ subject: string; heading: string; paragraphs: string[] }`) and `renderSequenceStep(step: RenderableStep, ctx: SequenceRenderContext, unsubscribeLink: string): { subject: string; react: ReactElement }`, both from `lib/email/render.ts`. `EmailSequenceStep` (Task 1) structurally satisfies `RenderableStep`, so Task 8's `enroll.ts` and `schedule.ts` can pass a DB row directly.

This task has no separate test of its own — `render.ts`'s output is a React element (visually verified via `npm run email`, per this repo's existing `email` script), and its logic is now a thin composition of Task 2's already-tested `substituteVariables`. The correctness gate here is Task 8's full engine test plus `npm run build`/`tsc`, which will fail loudly if any import of the deleted files survives.

- [ ] **Step 1: Rewrite `lib/email/templates/sequence-email.tsx`**

Replace its entire contents:

```tsx
import { Heading, Text } from "@react-email/components";
import { EmailLayout } from "@/lib/email/templates/layout";

interface SequenceEmailProps {
  heading: string;
  paragraphs: string[];
  unsubscribeLink: string;
}

export function SequenceEmail({ heading, paragraphs, unsubscribeLink }: SequenceEmailProps) {
  return (
    <EmailLayout unsubscribeLink={unsubscribeLink}>
      <Heading as="h2">{heading}</Heading>
      {paragraphs.map((paragraph, index) => (
        // Index key is safe here: paragraphs render once per call and never
        // reorder within a single render — unlike a list a user edits live.
        <Text key={index}>{paragraph}</Text>
      ))}
    </EmailLayout>
  );
}
```

- [ ] **Step 2: Rewrite `lib/email/render.ts`**

Replace its entire contents:

```ts
import { substituteVariables, type SequenceRenderContext } from "@/lib/email/variables";
import { SequenceEmail } from "@/lib/email/templates/sequence-email";

/** What renderSequenceStep needs from a step — email_sequence_steps rows
 *  (db/schema.ts) satisfy this structurally, extra columns and all. */
export interface RenderableStep {
  subject: string;
  heading: string;
  paragraphs: string[];
}

export function renderSequenceStep(step: RenderableStep, ctx: SequenceRenderContext, unsubscribeLink: string) {
  return {
    subject: substituteVariables(step.subject, ctx),
    react: SequenceEmail({
      heading: substituteVariables(step.heading, ctx),
      paragraphs: step.paragraphs.map((paragraph) => substituteVariables(paragraph, ctx)),
      unsubscribeLink,
    }),
  };
}
```

- [ ] **Step 3: Delete the hardcoded template system**

```bash
git rm lib/email/sequences.ts lib/email/copy.ts __tests__/sequences.test.ts
```

- [ ] **Step 4: Confirm nothing else still imports the deleted files**

Run: `npx tsc --noEmit`
Expected: FAIL at this point — `lib/email/schedule.ts` (and, transitively, its callers) still import from `lib/email/sequences`. This is expected; Task 8 fixes it. Do not attempt to fix `schedule.ts` in this task — the two changes are inseparable (see Task 8's own note), and this step exists only to confirm you've found every reference before moving on.

Run: `grep -rn "email/sequences\|email/copy" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected output at this point: only `lib/email/schedule.ts` (imports `SequenceContext`/`SequenceStep`) — everything else (Task 1-6's new files) never referenced the old modules. If anything else appears, stop and investigate before proceeding to Task 8.

- [ ] **Step 5: Commit**

```bash
git add lib/email/render.ts lib/email/templates/sequence-email.tsx
git commit -m "feat(email): render sequence emails from plain step content instead of the TemplateKey/COPY lookup

lib/email/schedule.ts still references the deleted lib/email/sequences.ts —
fixed in the next commit (Task 8), which replaces the whole engine in one
atomic change."
```

---

## Task 8: The DB-backed enrollment engine

**Files:**
- Modify: `lib/email/schedule.ts`
- Create: `lib/email/enroll.ts`
- Modify: `app/api/leads/route.ts`
- Modify: `lib/cron/reconcile.ts`
- Test: `__tests__/enroll.test.ts`

**Interfaces:**
- Consumes: `listEnabledSequencesForLeadCreated`, `getEmailSequenceStepForSend` (Task 4); `reserveScheduledEmails` with its new shape (Task 5); `RenderableStep`, `renderSequenceStep` (Task 7); `SequenceRenderContext` (Task 2).
- Produces: `enrollLeadOnCreate(scope: TrainerScope, lead: Lead): Promise<void>` from `lib/email/enroll.ts` — the direct replacement for the deleted `scheduleSequenceForLead`. `sendReservedStep` becomes an **exported** function from `lib/email/schedule.ts` (was module-private) so `enroll.ts` can reuse it.

This is one atomic task: `schedule.ts` cannot be fixed without `enroll.ts` existing, and neither compiles cleanly without the two call-site updates. Do not split further.

- [ ] **Step 1: Write the failing test**

Create `__tests__/enroll.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const listEnabledSequencesMock = vi.fn();
const reserveScheduledEmailsMock = vi.fn();
const getTrainerMock = vi.fn();
const sendReservedStepMock = vi.fn();

vi.mock("@/db/queries/email-sequences", () => ({
  listEnabledSequencesForLeadCreated: (...args: unknown[]) => listEnabledSequencesMock(...args),
}));
vi.mock("@/db/queries/scheduled-emails", () => ({
  reserveScheduledEmails: (...args: unknown[]) => reserveScheduledEmailsMock(...args),
}));
vi.mock("@/db/queries/trainers", () => ({
  getTrainer: (...args: unknown[]) => getTrainerMock(...args),
}));
vi.mock("@/lib/email/schedule", () => ({
  sendReservedStep: (...args: unknown[]) => sendReservedStepMock(...args),
}));
vi.mock("@/lib/email/client", () => ({ FROM_EMAIL: "Default <default@example.com>" }));
vi.mock("@/lib/unsubscribe", () => ({ unsubscribeLink: (leadId: string) => `https://example.com/u/${leadId}` }));

import { enrollLeadOnCreate } from "@/lib/email/enroll";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "site_key_ingest");

const baseLead = {
  id: "lead-1",
  trainerId: scope.trainerId,
  name: "Ana",
  email: "ana@example.com",
  source: "application" as const,
  stage: "application_received" as const,
  unsubscribedAt: null,
};

beforeEach(() => {
  listEnabledSequencesMock.mockReset();
  reserveScheduledEmailsMock.mockReset();
  getTrainerMock.mockReset();
  sendReservedStepMock.mockReset();
  getTrainerMock.mockResolvedValue({ name: "Janez", fromEmail: null });
});

describe("enrollLeadOnCreate", () => {
  it("does nothing when the lead is unsubscribed", async () => {
    await enrollLeadOnCreate(scope, { ...baseLead, unsubscribedAt: new Date() } as never);
    expect(listEnabledSequencesMock).not.toHaveBeenCalled();
  });

  it("does nothing when no sequence matches", async () => {
    listEnabledSequencesMock.mockResolvedValue([]);
    await enrollLeadOnCreate(scope, baseLead as never);
    expect(reserveScheduledEmailsMock).not.toHaveBeenCalled();
  });

  it("reserves and sends every step of a matching sequence", async () => {
    const step = { id: "step-1", subject: "S", heading: "H", paragraphs: ["P"], dayOffset: 0 };
    listEnabledSequencesMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-1", leadId: "lead-1", sequenceStep: "step-1", scheduledFor: new Date() },
    ]);

    await enrollLeadOnCreate(scope, baseLead as never);

    expect(sendReservedStepMock).toHaveBeenCalledTimes(1);
    const [row, sentStep] = sendReservedStepMock.mock.calls[0];
    expect(row.id).toBe("se-1");
    expect(sentStep).toBe(step);
  });

  it("skips a reserved row whose sequenceStep matches no known step (defensive, should be unreachable)", async () => {
    const step = { id: "step-1", subject: "S", heading: "H", paragraphs: ["P"], dayOffset: 0 };
    listEnabledSequencesMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([
      { id: "se-1", leadId: "lead-1", sequenceStep: "unknown-step", scheduledFor: new Date() },
    ]);

    await enrollLeadOnCreate(scope, baseLead as never);

    expect(sendReservedStepMock).not.toHaveBeenCalled();
  });

  it("skips reserving for a sequence when reserveScheduledEmails returns no rows (already enrolled)", async () => {
    const step = { id: "step-1", subject: "S", heading: "H", paragraphs: ["P"], dayOffset: 0 };
    listEnabledSequencesMock.mockResolvedValue([{ sequence: { id: "seq-1" }, steps: [step] }]);
    reserveScheduledEmailsMock.mockResolvedValue([]);

    await enrollLeadOnCreate(scope, baseLead as never);

    expect(sendReservedStepMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/enroll.test.ts`
Expected: FAIL — `lib/email/enroll.ts` does not exist yet.

- [ ] **Step 3: Rewrite `lib/email/schedule.ts`**

Replace its entire contents:

```ts
import { getEmailSequenceStepForSend } from "@/db/queries/email-sequences";
import { updateScheduledEmail } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { Lead, ScheduledEmail } from "@/db/schema";
import { resend, FROM_EMAIL } from "@/lib/email/client";
import { renderSequenceStep, type RenderableStep } from "@/lib/email/render";
import type { SequenceRenderContext } from "@/lib/email/variables";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

/**
 * Sends one reserved row to Resend and commits the result. Never throws —
 * a send failure leaves the row `pending` with `lastError` set, for the
 * cron reconciler to retry (using this same function) rather than losing
 * the attempt. Exported (was module-private) so lib/email/enroll.ts's
 * enrollLeadOnCreate can share it — the send/commit contract is unchanged;
 * only the step parameter's shape changed, from the old hardcoded
 * SequenceStep to any RenderableStep (email_sequence_steps rows satisfy
 * this structurally).
 */
export async function sendReservedStep(
  row: ScheduledEmail,
  step: RenderableStep,
  ctx: SequenceRenderContext,
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
 * Retries a `pending` row within the reconciler's safe retry window (see
 * lib/email/constants.ts and db/queries/scheduled-emails.ts's
 * listRetryablePendingScheduledEmails). Sends immediately rather than
 * reusing the original (now-past) scheduledFor — see the original doc for
 * why. Uses the same idempotencyKey, so if the original request actually
 * did land, this call safely returns the same Resend email id instead of
 * sending a duplicate.
 *
 * A row with no stepId is a legacy row from before this migration — there is
 * nothing to retry against, so it's left alone (surfaced by the digest via
 * its existing orphaned-row handling, not retried here).
 */
export async function retryPendingScheduledEmail(scope: TrainerScope, row: ScheduledEmail, lead: Lead): Promise<void> {
  if (!row.stepId) return;
  const step = await getEmailSequenceStepForSend(scope, row.stepId);
  if (!step) return; // the step (or its whole sequence) was deleted since this row was reserved

  const trainer = await getTrainer(scope);
  const link = unsubscribeLink(lead.id);
  const ctx: SequenceRenderContext = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;

  await sendReservedStep(row, step, ctx, link, lead.email, from);
}
```

- [ ] **Step 4: Create `lib/email/enroll.ts`**

```ts
import { addDays } from "date-fns";
import { listEnabledSequencesForLeadCreated } from "@/db/queries/email-sequences";
import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { EmailSequenceStep, Lead } from "@/db/schema";
import { FROM_EMAIL } from "@/lib/email/client";
import { IMMEDIATE_SEND_DELAY_SECONDS } from "@/lib/email/constants";
import { sendReservedStep } from "@/lib/email/schedule";
import type { SequenceRenderContext } from "@/lib/email/variables";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

/**
 * Enrolls a freshly created lead into every one of the trainer's enabled,
 * lead_created-triggered sequences whose triggerSource matches (or is null,
 * meaning "any source"). Replaces the old hardcoded scheduleSequenceForLead
 * — sequences are now trainer data (email_sequences/email_sequence_steps),
 * not code. Still follows the exact reserve->send->commit protocol
 * documented in lib/email/schedule.ts; this function's job is only to
 * decide WHICH steps to reserve.
 *
 * Called from exactly the same two places the old function was:
 * app/api/leads/route.ts's POST handler (on a genuine insert) and the cron
 * reconciler (lib/cron/reconcile.ts).
 */
export async function enrollLeadOnCreate(scope: TrainerScope, lead: Lead): Promise<void> {
  if (lead.unsubscribedAt) return; // never resurrect a sequence for an opted-out lead

  const matches = await listEnabledSequencesForLeadCreated(scope, lead.source);
  if (matches.length === 0) return;

  const trainer = await getTrainer(scope);
  const ctx: SequenceRenderContext = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;
  const link = unsubscribeLink(lead.id);
  const now = new Date();

  for (const { steps } of matches) {
    if (steps.length === 0) continue;

    const reserved = await reserveScheduledEmails(
      scope,
      steps.map((step) => ({
        leadId: lead.id,
        sequenceStep: step.id,
        stepId: step.id,
        kind: "sequence" as const,
        scheduledFor:
          step.dayOffset === 0
            ? new Date(now.getTime() + IMMEDIATE_SEND_DELAY_SECONDS * 1000)
            : addDays(now, step.dayOffset),
      })),
    );
    if (reserved.length === 0) continue; // already enrolled in this sequence — idempotent no-op

    const stepsById = new Map<string, EmailSequenceStep>(steps.map((step) => [step.id, step]));
    for (const row of reserved) {
      const step = stepsById.get(row.sequenceStep);
      if (!step) continue; // unreachable — sequenceStep is always one of `steps`' own ids here
      await sendReservedStep(row, step, ctx, link, lead.email, from, row.scheduledFor.toISOString());
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/enroll.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Update `app/api/leads/route.ts`**

Change the import:

```ts
import { enrollLeadOnCreate } from "@/lib/email/enroll";
```

(replacing `import { scheduleSequenceForLead } from "@/lib/email/schedule";`), and change the call site:

```ts
      try {
        await enrollLeadOnCreate(scope, lead);
      } catch (err) {
        logLeadIntakeError("enrollLeadOnCreate", err);
      }
```

(replacing the `scheduleSequenceForLead` call and its log-tag string). Update the comment two lines above it (`// ... scheduleSequenceForLead itself never throws ...`) to say `enrollLeadOnCreate` instead.

- [ ] **Step 7: Update `lib/cron/reconcile.ts`**

Change the import line:

```ts
import { enrollLeadOnCreate } from "@/lib/email/enroll";
import { retryPendingScheduledEmail } from "@/lib/email/schedule";
```

(replacing `import { retryPendingScheduledEmail, scheduleSequenceForLead } from "@/lib/email/schedule";`), and change the call site inside the `for (const lead of missingLeads)` loop from `await scheduleSequenceForLead(scope, lead);` to `await enrollLeadOnCreate(scope, lead);`. Update the header comment above `reconcile()` that says "get scheduleSequenceForLead()" to say "get enrollLeadOnCreate()".

- [ ] **Step 8: Confirm the old system is fully gone**

Run: `grep -rn "email/sequences\|email/copy\|scheduleSequenceForLead" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: no output.

- [ ] **Step 9: Full typecheck, lint, and test suite**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm run test`
Expected: PASS (every existing test, plus every test added in Tasks 1-8).

- [ ] **Step 10: Commit**

```bash
git add lib/email/schedule.ts lib/email/enroll.ts app/api/leads/route.ts lib/cron/reconcile.ts __tests__/enroll.test.ts
git commit -m "feat(email): replace scheduleSequenceForLead with the DB-backed enrollLeadOnCreate engine"
```

---

## Task 9: Seed new trainers with default sequences

**Files:**
- Create: `lib/email/seed-defaults.ts`
- Modify: `lib/actions/auth.ts`
- Create: `scripts/seed-default-sequences.ts`
- Modify: `scripts/seed-demo.ts`
- Modify: `package.json`
- Test: `__tests__/seed-defaults.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SEQUENCES` (Task 6), `createEmailSequence` (Task 4).
- Produces: `seedDefaultSequencesForTrainer(scope: TrainerScope): Promise<void>` from `lib/email/seed-defaults.ts`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/seed-defaults.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const createEmailSequenceMock = vi.fn();

vi.mock("@/db/queries/email-sequences", () => ({
  createEmailSequence: (...args: unknown[]) => createEmailSequenceMock(...args),
}));

import { seedDefaultSequencesForTrainer } from "@/lib/email/seed-defaults";
import { DEFAULT_SEQUENCES } from "@/lib/email/default-sequences";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "registration");

beforeEach(() => {
  createEmailSequenceMock.mockReset();
});

describe("seedDefaultSequencesForTrainer", () => {
  it("creates one sequence per entry in DEFAULT_SEQUENCES", async () => {
    createEmailSequenceMock.mockResolvedValue({ id: "seq-1" });

    await seedDefaultSequencesForTrainer(scope);

    expect(createEmailSequenceMock).toHaveBeenCalledTimes(DEFAULT_SEQUENCES.length);
  });

  it("passes each sequence's name, triggerSource, and steps through, enabled by default", async () => {
    createEmailSequenceMock.mockResolvedValue({ id: "seq-1" });

    await seedDefaultSequencesForTrainer(scope);

    const firstCallInput = createEmailSequenceMock.mock.calls[0][1];
    expect(firstCallInput).toMatchObject({
      name: DEFAULT_SEQUENCES[0].name,
      triggerSource: DEFAULT_SEQUENCES[0].triggerSource,
      enabled: true,
    });
    expect(firstCallInput.steps).toHaveLength(DEFAULT_SEQUENCES[0].steps.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/seed-defaults.test.ts`
Expected: FAIL — `lib/email/seed-defaults.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/email/seed-defaults.ts`**

```ts
import { createEmailSequence } from "@/db/queries/email-sequences";
import { DEFAULT_SEQUENCES } from "@/lib/email/default-sequences";
import type { TrainerScope } from "@/lib/tenant";

/**
 * Gives a brand-new trainer the same two starter sequences the product
 * shipped with before Phase 1 (lib/email/default-sequences.ts), so a
 * trainer who never opens /emails/sequences still gets the fast
 * application-confirmation flow and the lead-magnet nurture sequence.
 * Called once, at trainer creation — see lib/actions/auth.ts's
 * redeemInviteAction — and by scripts/seed-default-sequences.ts's one-off
 * backfill for trainers that predate this feature.
 */
export async function seedDefaultSequencesForTrainer(scope: TrainerScope): Promise<void> {
  for (const sequence of DEFAULT_SEQUENCES) {
    await createEmailSequence(scope, {
      name: sequence.name,
      triggerSource: sequence.triggerSource,
      enabled: true,
      steps: sequence.steps,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/seed-defaults.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Wire seeding into trainer registration**

In `lib/actions/auth.ts`, add the import:

```ts
import { seedDefaultSequencesForTrainer } from "@/lib/email/seed-defaults";
import { systemScope } from "@/lib/tenant";
```

Then, inside `redeemInviteAction`, right after `const { trainer } = await createUserAndTrainer({...});` and before the `try { await signIn(...) }` block, add:

```ts
  // registration: this is the ONLY place trainer creation and sequence
  // seeding happen together outside a script — see systemScope's doc for
  // why "registration" is its own closed reason.
  await seedDefaultSequencesForTrainer(systemScope(trainer.id, "registration"));
```

- [ ] **Step 6: Create the backfill script**

Create `scripts/seed-default-sequences.ts`:

```ts
import { config } from "dotenv";

// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

/**
 * One-off backfill for trainers created before Phase 1's email-sequences
 * feature shipped — gives each of them the same two starter sequences a
 * newly registered trainer gets automatically (see lib/actions/auth.ts).
 * Idempotent: skips any trainer who already has at least one sequence row,
 * so re-running this after the fact is a safe no-op.
 */
async function main() {
  const { db } = await import("../db");
  const { trainers, emailSequences } = await import("../db/schema");
  const { seedDefaultSequencesForTrainer } = await import("../lib/email/seed-defaults");
  const { systemScope } = await import("../lib/tenant");

  const allTrainers = await db.select().from(trainers);
  const existingSequenceTrainerIds = await db
    .select({ trainerId: emailSequences.trainerId })
    .from(emailSequences);
  const alreadySeeded = new Set(existingSequenceTrainerIds.map((row) => row.trainerId));

  let seeded = 0;
  for (const trainer of allTrainers) {
    if (alreadySeeded.has(trainer.id)) continue;
    await seedDefaultSequencesForTrainer(systemScope(trainer.id, "operator_cli"));
    seeded++;
    console.log(`Seeded default sequences for ${trainer.name} (${trainer.id}).`);
  }
  console.log(`Done. Seeded ${seeded} trainer(s); ${allTrainers.length - seeded} already had sequences.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

Add the script to `package.json`'s `"scripts"` block (alphabetically near the other `seed:*`/`trainer:*` entries):

```json
    "seed:default-sequences": "tsx scripts/seed-default-sequences.ts",
```

- [ ] **Step 7: Update the demo seed script**

In `scripts/seed-demo.ts`, add the import inside `main()`'s dynamic-import block:

```ts
  const { seedDefaultSequencesForTrainer } = await import("../lib/email/seed-defaults");
```

Then, right after the existing `await updateApplicationQuestions(scope, [...]);` call, add:

```ts

  await seedDefaultSequencesForTrainer(scope);
```

- [ ] **Step 8: Manual verification**

Run: `npm run seed:demo`
Expected: script completes; log output includes no errors from the new seeding call.

Run against the dev DB (psql, Drizzle Studio, or a quick `tsx` one-liner) to confirm `email_sequences` now has 2 rows for the demo trainer and `email_sequence_steps` has 9 rows total (4 + 5) — this is a manual check, not an automated test, since it exercises the real database.

- [ ] **Step 9: Full check**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/email/seed-defaults.ts lib/actions/auth.ts scripts/seed-default-sequences.ts scripts/seed-demo.ts package.json __tests__/seed-defaults.test.ts
git commit -m "feat(email): seed default sequences on trainer registration, plus a backfill script for existing trainers"
```

---

## Task 10: Server actions

**Files:**
- Create: `lib/actions/email-sequences.ts`

**Interfaces:**
- Consumes: `createEmailSequence`, `updateEmailSequence`, `setEmailSequenceEnabled`, `SequenceLimitExceededError` (Task 4); `emailSequenceFormSchema` (Task 3).
- Produces: `createEmailSequenceAction(input: unknown): Promise<ActionResult>`, `updateEmailSequenceAction(sequenceId: string, input: unknown): Promise<ActionResult>`, `setEmailSequenceEnabledAction(sequenceId: string, enabled: boolean): Promise<ActionResult>` — consumed by Task 11's UI components.

No dedicated unit test for this task: it's a thin Server Action wrapper (validate → call query function → `refresh()`) with no branching logic beyond what Task 3's validation tests and Task 4's query tests already cover — exactly the same reasoning `lib/actions/settings.ts` (its closest sibling in this codebase) is left untested.

- [ ] **Step 1: Implement `lib/actions/email-sequences.ts`**

```ts
"use server";

import { refresh } from "next/cache";
import {
  createEmailSequence,
  SequenceLimitExceededError,
  setEmailSequenceEnabled,
  updateEmailSequence,
} from "@/db/queries/email-sequences";
import { requireTrainerOrThrow } from "@/lib/tenant";
import { emailSequenceFormSchema } from "@/lib/validation/email-sequences";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createEmailSequenceAction(input: unknown): Promise<ActionResult> {
  const parsed = emailSequenceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  try {
    await createEmailSequence(scope, parsed.data);
  } catch (err) {
    if (err instanceof SequenceLimitExceededError) {
      return { ok: false, error: "sequenceLimit" };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function updateEmailSequenceAction(sequenceId: string, input: unknown): Promise<ActionResult> {
  const parsed = emailSequenceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  const updated = await updateEmailSequence(scope, sequenceId, parsed.data);
  if (!updated) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}

export async function setEmailSequenceEnabledAction(sequenceId: string, enabled: boolean): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  const updatedRow = await setEmailSequenceEnabled(scope, sequenceId, enabled);
  if (!updatedRow) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/email-sequences.ts
git commit -m "feat(email): add server actions for creating, updating, and toggling sequences"
```

---

## Task 11: Dashboard UI

**Files:**
- Modify: `lib/strings.ts`
- Modify: `app/(dashboard)/emails/page.tsx`
- Create: `components/emails/sequence-list.tsx`
- Create: `components/emails/sequence-form.tsx`
- Create: `app/(dashboard)/emails/sequences/page.tsx`
- Create: `app/(dashboard)/emails/sequences/new/page.tsx`
- Create: `app/(dashboard)/emails/sequences/[id]/page.tsx`

**Interfaces:**
- Consumes: `listEmailSequencesForTrainer`, `getEmailSequenceWithSteps`, `EmailSequenceSummary` (Task 4); `createEmailSequenceAction`, `updateEmailSequenceAction`, `setEmailSequenceEnabledAction` (Task 10); `MAX_SEQUENCES_PER_TRAINER`, `MAX_STEPS_PER_SEQUENCE` (Task 3); `emailSequenceFormSchema` (Task 3).
- Produces: three new routes under `/emails/sequences`; no other task depends on this one.

- [ ] **Step 1: Add Slovenian strings**

In `lib/strings.ts`, inside the existing `emails: { ... }` block, add these entries after `cancelButton: "Prekliči",`:

```ts
    manageSequences: "Uredi sekvence",
    sequencesTitle: "Sekvence e-sporočil",
    sequencesEmpty: "Ni še nobene sekvence.",
    sequenceCreate: "Nova sekvenca",
    sequenceLimitReached: "Dosegli ste največje število sekvenc (5).",
    sequenceColumnName: "Ime",
    sequenceColumnTrigger: "Vir",
    sequenceColumnSteps: "Koraki",
    sequenceColumnStatus: "Status",
    sequenceStatusEnabled: "Aktivna",
    sequenceStatusDisabled: "Izklopljena",
    sequenceEnable: "Vklopi",
    sequenceDisable: "Izklopi",
    sequenceTriggerAnySource: "Vsi viri",
    sequenceDetailsTitle: "Osnovni podatki",
    sequenceNameLabel: "Ime sekvence",
    sequenceTriggerLabel: "Sproži ob prijavi z vira",
    sequenceEnabledLabel: "Sekvenca je aktivna",
    sequenceSave: "Shrani sekvenco",
    sequenceBackToList: "Nazaj na sekvence",
    sequenceNewTitle: "Nova sekvenca",
    sequenceEditTitle: "Uredi sekvenco",
    stepTitle: (n: number) => `Korak ${n}`,
    stepDayOffsetLabel: "Dan po prijavi",
    stepSubjectLabel: "Zadeva e-sporočila",
    stepHeadingLabel: "Naslov v e-sporočilu",
    stepBodyLabel: "Besedilo",
    stepBodyHint: "Ločite odstavke s prazno vrstico. Uporabite {{ime}} za ime stranke in {{trener}} za vaše ime.",
    stepMoveUp: "Gor",
    stepMoveDown: "Dol",
    stepDelete: "Izbriši korak",
    stepAdd: "Dodaj korak",
```

- [ ] **Step 2: Create `components/emails/sequence-list.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmailSequenceSummary } from "@/db/queries/email-sequences";
import { setEmailSequenceEnabledAction } from "@/lib/actions/email-sequences";
import { leadSourceLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";

function ToggleEnabledButton({ sequenceId, enabled }: { sequenceId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await setEmailSequenceEnabledAction(sequenceId, !enabled);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {enabled ? sl.emails.sequenceDisable : sl.emails.sequenceEnable}
    </Button>
  );
}

export function SequenceList({ sequences }: { sequences: EmailSequenceSummary[] }) {
  if (sequences.length === 0) {
    return <p className="text-muted-foreground">{sl.emails.sequencesEmpty}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{sl.emails.sequenceColumnName}</TableHead>
          <TableHead>{sl.emails.sequenceColumnTrigger}</TableHead>
          <TableHead>{sl.emails.sequenceColumnSteps}</TableHead>
          <TableHead>{sl.emails.sequenceColumnStatus}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sequences.map((sequence) => (
          <TableRow key={sequence.id}>
            <TableCell>
              <Link href={`/emails/sequences/${sequence.id}`} className="font-medium hover:underline">
                {sequence.name}
              </Link>
            </TableCell>
            <TableCell>
              {sequence.triggerSource ? leadSourceLabels[sequence.triggerSource] : sl.emails.sequenceTriggerAnySource}
            </TableCell>
            <TableCell>{sequence.stepCount}</TableCell>
            <TableCell>
              <Badge variant={sequence.enabled ? "default" : "secondary"}>
                {sequence.enabled ? sl.emails.sequenceStatusEnabled : sl.emails.sequenceStatusDisabled}
              </Badge>
            </TableCell>
            <TableCell>
              <ToggleEnabledButton sequenceId={sequence.id} enabled={sequence.enabled} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create `components/emails/sequence-form.tsx`**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmailSequence, EmailSequenceStep, LeadSource } from "@/db/schema";
import { createEmailSequenceAction, updateEmailSequenceAction } from "@/lib/actions/email-sequences";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { leadSourceLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { emailSequenceFormSchema } from "@/lib/validation/email-sequences";

interface StepFormValues {
  id?: string;
  subject: string;
  heading: string;
  paragraphsText: string;
  dayOffset: number;
}

interface SequenceFormValues {
  name: string;
  triggerSource: LeadSource | "any";
  enabled: boolean;
  steps: StepFormValues[];
}

const stepFormSchema = z.object({
  id: z.uuid().optional(),
  subject: z.string().trim().min(1, { error: "Zadeva je obvezna." }).max(200),
  heading: z.string().trim().min(1, { error: "Naslov je obvezen." }).max(200),
  paragraphsText: z.string().trim().min(1, { error: "Dodajte vsaj en odstavek besedila." }),
  dayOffset: z
    .number()
    .int()
    .min(0, { error: "Dan mora biti 0 ali več." })
    .max(MAX_SCHEDULE_DAYS, { error: `Dan ne sme biti večji od ${MAX_SCHEDULE_DAYS}.` }),
});

const sequenceFormSchema = z.object({
  name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
  triggerSource: z.enum(["application", "lead_magnet", "any"]),
  enabled: z.boolean(),
  steps: z.array(stepFormSchema).min(1, { error: "Sekvenca potrebuje vsaj en korak." }).max(MAX_STEPS_PER_SEQUENCE),
});

function paragraphsToText(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function textToParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const EMPTY_STEP: StepFormValues = { subject: "", heading: "", paragraphsText: "", dayOffset: 0 };

export function SequenceForm({ sequence, steps }: { sequence?: EmailSequence; steps?: EmailSequenceStep[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SequenceFormValues>({
    resolver: zodResolver(sequenceFormSchema),
    defaultValues: {
      name: sequence?.name ?? "",
      triggerSource: sequence?.triggerSource ?? "any",
      enabled: sequence?.enabled ?? true,
      steps:
        steps && steps.length > 0
          ? steps.map((step) => ({
              id: step.id,
              subject: step.subject,
              heading: step.heading,
              paragraphsText: paragraphsToText(step.paragraphs),
              dayOffset: step.dayOffset,
            }))
          : [EMPTY_STEP],
    },
  });

  // keyName avoids react-hook-form silently overwriting a step's own `id`
  // (a real email_sequence_steps.id) with its internal row key.
  const { fields, append, remove, move } = useFieldArray({ control, name: "steps", keyName: "_rowKey" });

  async function onSubmit(values: SequenceFormValues) {
    setIsSaving(true);
    const payload = {
      name: values.name,
      triggerSource: values.triggerSource === "any" ? null : values.triggerSource,
      enabled: values.enabled,
      steps: values.steps.map((step) => ({
        id: step.id,
        subject: step.subject,
        heading: step.heading,
        paragraphs: textToParagraphs(step.paragraphsText),
        dayOffset: step.dayOffset,
      })),
    };

    // Re-validates the transformed payload (paragraphsText -> paragraphs[])
    // against the same schema the server action re-validates — catches a
    // paragraph split producing zero paragraphs before the round trip.
    const parsed = emailSequenceFormSchema.safeParse(payload);
    if (!parsed.success) {
      setIsSaving(false);
      toast.error(sl.errors.validation);
      return;
    }

    const result = sequence
      ? await updateEmailSequenceAction(sequence.id, parsed.data)
      : await createEmailSequenceAction(parsed.data);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error === "sequenceLimit" ? sl.emails.sequenceLimitReached : sl.errors.validation);
      return;
    }
    toast.success(sl.settings.savedSuccess);
    router.push("/emails/sequences");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{sl.emails.sequenceDetailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sequenceNameLabel}</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sequenceTriggerLabel}</Label>
            <Controller
              control={control}
              name="triggerSource"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{sl.emails.sequenceTriggerAnySource}</SelectItem>
                    <SelectItem value="application">{leadSourceLabels.application}</SelectItem>
                    <SelectItem value="lead_magnet">{leadSourceLabels.lead_magnet}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register("enabled")} className="size-4" />
            <Label>{sl.emails.sequenceEnabledLabel}</Label>
          </div>
        </CardContent>
      </Card>

      {fields.map((field, index) => {
        const rowErrors = errors.steps?.[index];
        return (
          <Card key={field._rowKey}>
            <CardHeader>
              <CardTitle>{sl.emails.stepTitle(index + 1)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepDayOffsetLabel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={MAX_SCHEDULE_DAYS}
                    {...register(`steps.${index}.dayOffset`, { valueAsNumber: true })}
                  />
                  {rowErrors?.dayOffset && <p className="text-xs text-destructive">{rowErrors.dayOffset.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepSubjectLabel}</Label>
                  <Input {...register(`steps.${index}.subject`)} />
                  {rowErrors?.subject && <p className="text-xs text-destructive">{rowErrors.subject.message}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>{sl.emails.stepHeadingLabel}</Label>
                <Input {...register(`steps.${index}.heading`)} />
                {rowErrors?.heading && <p className="text-xs text-destructive">{rowErrors.heading.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label>{sl.emails.stepBodyLabel}</Label>
                <p className="text-xs text-muted-foreground">{sl.emails.stepBodyHint}</p>
                <Textarea rows={6} {...register(`steps.${index}.paragraphsText`)} />
                {rowErrors?.paragraphsText && (
                  <p className="text-xs text-destructive">{rowErrors.paragraphsText.message}</p>
                )}
              </div>
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    {sl.emails.stepMoveUp}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    {sl.emails.stepMoveDown}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  {sl.emails.stepDelete}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => append(EMPTY_STEP)}
        disabled={fields.length >= MAX_STEPS_PER_SEQUENCE}
        className="self-start"
      >
        {sl.emails.stepAdd}
      </Button>

      <Button type="submit" disabled={isSaving} className="self-end">
        {sl.emails.sequenceSave}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Create `app/(dashboard)/emails/sequences/page.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SequenceList } from "@/components/emails/sequence-list";
import { listEmailSequencesForTrainer } from "@/db/queries/email-sequences";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EmailSequencesPage() {
  const scope = await requireTrainer();
  const sequences = await listEmailSequencesForTrainer(scope);
  const atLimit = sequences.length >= MAX_SEQUENCES_PER_TRAINER;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/emails" className="text-sm text-muted-foreground hover:underline">
        &larr; {sl.emails.title}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sequencesTitle}</h1>
        <Button size="sm" disabled={atLimit} render={<Link href="/emails/sequences/new" />}>
          {sl.emails.sequenceCreate}
        </Button>
      </div>
      {atLimit && <p className="text-sm text-muted-foreground">{sl.emails.sequenceLimitReached}</p>}
      <SequenceList sequences={sequences} />
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(dashboard)/emails/sequences/new/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SequenceForm } from "@/components/emails/sequence-form";
import { listEmailSequencesForTrainer } from "@/db/queries/email-sequences";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function NewEmailSequencePage() {
  const scope = await requireTrainer();
  const sequences = await listEmailSequencesForTrainer(scope);
  if (sequences.length >= MAX_SEQUENCES_PER_TRAINER) {
    redirect("/emails/sequences");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sequenceNewTitle}</h1>
        <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
          {sl.emails.sequenceBackToList}
        </Button>
      </div>
      <SequenceForm />
    </div>
  );
}
```

- [ ] **Step 6: Create `app/(dashboard)/emails/sequences/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SequenceForm } from "@/components/emails/sequence-form";
import { getEmailSequenceWithSteps } from "@/db/queries/email-sequences";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EditEmailSequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTrainer();
  const result = await getEmailSequenceWithSteps(scope, id);
  if (!result) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sequenceEditTitle}</h1>
        <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
          {sl.emails.sequenceBackToList}
        </Button>
      </div>
      <SequenceForm sequence={result.sequence} steps={result.steps} />
    </div>
  );
}
```

- [ ] **Step 7: Link from the existing `/emails` log page**

In `app/(dashboard)/emails/page.tsx`, add the import:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
```

Then change the page's opening `<h1>` line:

```tsx
      <h1 className="text-xl font-semibold">{sl.emails.title}</h1>
```

to a header row with a link to the new sequences list:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.title}</h1>
        <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
          {sl.emails.manageSequences}
        </Button>
      </div>
```

- [ ] **Step 8: Full check**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: all PASS. (`npm run build` requires `DATABASE_URL` in `.env.local`, per this repo's existing convention.)

- [ ] **Step 9: Manual smoke test**

Run: `npm run dev`, log in as the demo trainer (`npm run seed:demo` credentials), and:
1. Open `/emails`, click "Uredi sekvence" → lands on `/emails/sequences` showing the 2 seeded sequences (4 and 5 steps).
2. Click into "Prijave" → edit a step's subject/heading/body, change its day offset, save → toast confirms, list shows updated step count if a step was added/removed.
3. Click "Vklopi"/"Izklopi" on a sequence → badge and button label flip immediately.
4. Click "Nova sekvenca", fill in name + at least one step, save → appears in the list; repeat until 5 sequences exist → "Nova sekvenca" button becomes disabled and the limit message appears.
5. Submit a test lead against `POST /api/leads` with the demo trainer's `site_key` and `source: "application"` → confirm in the Resend dashboard that an email is scheduled using the *edited* step content from #2, not the original seed text.

- [ ] **Step 10: Commit**

```bash
git add lib/strings.ts app/\(dashboard\)/emails/page.tsx components/emails/sequence-list.tsx components/emails/sequence-form.tsx "app/(dashboard)/emails/sequences"
git commit -m "feat(dashboard): add the sequence list/create/edit UI under /emails/sequences"
```

---

## Task 12: Phase 1 verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full automated suite**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm run test`
Run: `npm run build`

Expected: all four PASS with zero errors/warnings introduced by this plan.

- [ ] **Step 2: Confirm no dead references remain**

Run: `grep -rn "TemplateKey\|SequenceContext\b" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: no output (both were fully retired in Tasks 6-8; `SequenceRenderContext` is the only surviving name).

- [ ] **Step 3: Re-run the full manual smoke test from Task 11's Step 9**

If anything drifted since Task 11 (e.g. a later task's fix touched the UI), repeat it end-to-end once more.

- [ ] **Step 4: Dispatch the repository's `security-reviewer` subagent**

This phase modified `db/schema.ts` and added several new `trainerId`-scoped query paths (`db/queries/email-sequences.ts`, the `scheduled_emails` reserve path). Per this repo's own convention (`security-reviewer`'s stated trigger list), dispatch it now, read-only, against the full diff since this plan's base commit. Address any findings it reports before considering Phase 1 done.

- [ ] **Step 5: Final commit (if Step 4 required fixes)**

```bash
git add -A
git commit -m "fix(email): address security-reviewer findings from Phase 1's final review"
```

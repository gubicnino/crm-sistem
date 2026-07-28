# Dashboard Tabs, Pipeline Shrink, and Lead Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing CRM dashboard implementation in line with the updated `CLAUDE.md`: a 4-stage pipeline, email-only cross-source lead deduplication, full lead CRUD, and two new dashboard tabs (Izpolnjene forme, Emaili).

**Architecture:** No new subsystems — this extends an already-built Next.js App Router + Drizzle + Postgres codebase. Every task follows patterns already established in the repo: `TrainerScope`-scoped Drizzle queries (`lib/tenant.ts`), thin Server Actions returning `{ ok: true } | { ok: false; error }` (`lib/actions/*.ts`), Slovenian strings centralized in `lib/strings.ts`, Vitest unit tests that mock `@/db`'s query-builder chain.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM + drizzle-kit, Neon Postgres, Vitest, react-hook-form + Zod, shadcn/ui (base-ui primitives), Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-28-dashboard-tabs-and-pipeline-update-design.md`

## Global Constraints

- Tenant isolation: every domain-table query must go through `scoped()`/`ownedBy()` with a `TrainerScope` from `requireTrainer()` (pages) or `requireTrainerOrThrow()` (Server Actions) — never a raw `trainerId` from params/body.
- UI text: Slovenian, added only to `lib/strings.ts`'s `sl` object, grouped by surface. Code/comments/commits: English. Never mixed.
- ORM: Drizzle only (no Prisma). Schema changes go through `npx drizzle-kit generate` — never hand-write migration SQL, never edit an already-applied migration.
- `db/queries/leads.ts`'s `setLeadStage()` remains the only function allowed to write `leads.stage` outside of `createLeadFromIntake`'s conflict-path CASE expression — enforced by the `no-restricted-syntax` ESLint rule in `eslint.config.mjs`. Do not add another `.set({ stage: ... })` call site.
- Server Components by default; `"use client"` only for genuine interactivity. Server Actions for dashboard mutations (never a Route Handler for these).
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` must all pass before a task is considered done. `npm run build` requires `DATABASE_URL` to be set in `.env.local` (it fails with "DATABASE_URL is not set" otherwise — this is a pre-existing project requirement, not new).
- `npx drizzle-kit generate` / `npx drizzle-kit migrate` also require `DATABASE_URL` in `.env.local` (see `drizzle.config.ts`).
- No `localStorage`. No new dependencies beyond what's already in `package.json` (this plan introduces none).

---

## Task 1: Centralize the terminal-stage check in `lib/pipeline.ts`

**Files:**
- Modify: `lib/pipeline.ts`
- Modify: `lib/cron/stuck-leads.ts`
- Modify: `lib/cron/reconcile.ts:65`
- Modify: `db/queries/analytics.ts:62`
- Modify: `db/queries/leads.ts:111,155`
- Test: `__tests__/pipeline-terminal-stage.test.ts` (create)

**Interfaces:**
- Produces: `TERMINAL_STAGES: readonly PipelineStage[]` and `isTerminalStage(stage: PipelineStage): boolean`, both exported from `lib/pipeline.ts`. Every later task that needs to know "is this stage client-or-lost" imports these instead of writing a new literal comparison.

A grep today finds `stage === "client" || stage === "lost"` (or the `notInArray` equivalent) hardcoded independently in five places. This task gives them one source of truth. Note: `db/queries/analytics.ts:60` (`if (lead.stage === "client") clientCount++`) is a *different* check — "is this a conversion", not "is this terminal" — and must NOT be touched; only line 62 (`lead.stage !== "client" && lead.stage !== "lost"`) is the terminal-set check.

- [ ] **Step 1: Write the failing test**

Create `__tests__/pipeline-terminal-stage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isTerminalStage, TERMINAL_STAGES } from "@/lib/pipeline";

describe("isTerminalStage", () => {
  it("returns true for client", () => {
    expect(isTerminalStage("client")).toBe(true);
  });

  it("returns true for lost", () => {
    expect(isTerminalStage("lost")).toBe(true);
  });

  it("returns false for a non-terminal stage", () => {
    expect(isTerminalStage("contacted")).toBe(false);
  });

  it("TERMINAL_STAGES contains exactly client and lost", () => {
    expect([...TERMINAL_STAGES].sort()).toEqual(["client", "lost"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/pipeline-terminal-stage.test.ts`
Expected: FAIL — `isTerminalStage`/`TERMINAL_STAGES` are not exported from `lib/pipeline.ts`.

- [ ] **Step 3: Implement in `lib/pipeline.ts`**

Full new file content:

```ts
import { pipelineStageEnum, type PipelineStage } from "@/db/schema";

/** Kanban column order (Phase 5) — 'lost' is a terminal bucket shown last. */
export const PIPELINE_STAGES = pipelineStageEnum.enumValues;

/**
 * Single source of truth for "this stage is a dead end" — a lead here never
 * receives further sequence emails and is excluded from stuck-lead detection.
 * Previously hardcoded independently as `stage === "client" || stage ===
 * "lost"` in five places (lib/cron/stuck-leads.ts, lib/cron/reconcile.ts,
 * db/queries/analytics.ts, db/queries/leads.ts x2) — consolidated here so a
 * future stage change only touches one place.
 */
export const TERMINAL_STAGES: readonly PipelineStage[] = ["client", "lost"];

export function isTerminalStage(stage: PipelineStage): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage);
}

/**
 * Days in a stage before a lead is considered "stuck" — shared between the
 * Phase 5 analytics stuck-count and the Phase 6 cron digest, so the two never
 * drift apart. `email_lead` has no threshold (cold leads sit there
 * indefinitely by design); `client`/`lost` are terminal.
 */
export const STUCK_THRESHOLD_DAYS: Partial<Record<PipelineStage, number>> = {
  application_received: 2,
  contacted: 5,
  call_scheduled: 3,
  offer_sent: 7,
};

export function isStuck(stage: PipelineStage, daysInStage: number): boolean {
  const threshold = STUCK_THRESHOLD_DAYS[stage];
  return threshold !== undefined && daysInStage >= threshold;
}
```

(The `call_scheduled`/`offer_sent` entries in `STUCK_THRESHOLD_DAYS` are removed in Task 2, not here — this task only adds `TERMINAL_STAGES`/`isTerminalStage` without otherwise changing the file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/pipeline-terminal-stage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Replace the hardcoded check in `lib/cron/stuck-leads.ts`**

```ts
import type { Lead } from "@/db/schema";
import { isStuck, isTerminalStage } from "@/lib/pipeline";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Computed, not stored — changing a threshold in lib/pipeline.ts needs no
 *  backfill. Used by both the digest and (potentially) future dashboard UI. */
export function findStuckLeads(leads: Lead[], now: number = Date.now()): Lead[] {
  return leads.filter((lead) => {
    if (isTerminalStage(lead.stage)) return false;
    const daysInStage = (now - lead.stageChangedAt.getTime()) / DAY_MS;
    return isStuck(lead.stage, daysInStage);
  });
}
```

- [ ] **Step 6: Replace the hardcoded check in `lib/cron/reconcile.ts`**

Change the import line to add `isTerminalStage`:

```ts
import { isTerminalStage } from "@/lib/pipeline";
```

Change line 65 from:

```ts
      if (!lead || lead.unsubscribedAt || lead.stage === "client" || lead.stage === "lost") continue;
```

to:

```ts
      if (!lead || lead.unsubscribedAt || isTerminalStage(lead.stage)) continue;
```

- [ ] **Step 7: Replace the hardcoded check in `db/queries/analytics.ts`**

Add to the imports:

```ts
import { isStuck, isTerminalStage } from "@/lib/pipeline";
```

Change line 62 from:

```ts
    if (lead.stage !== "client" && lead.stage !== "lost") {
```

to:

```ts
    if (!isTerminalStage(lead.stage)) {
```

Leave line 60 (`if (lead.stage === "client") clientCount++;`) untouched — it's a conversion check, not a terminal-stage check.

- [ ] **Step 8: Replace the two hardcoded checks in `db/queries/leads.ts`**

Add to the imports:

```ts
import { isTerminalStage, TERMINAL_STAGES } from "@/lib/pipeline";
```

Change line 111 from:

```ts
  if (next === "client" || next === "lost") {
```

to:

```ts
  if (isTerminalStage(next)) {
```

Change line 155 from:

```ts
        notInArray(leads.stage, ["client", "lost"]),
```

to:

```ts
        notInArray(leads.stage, [...TERMINAL_STAGES]),
```

- [ ] **Step 9: Run the full test suite, typecheck, and lint**

Run: `npx vitest run`
Expected: all existing tests still PASS (`tenant-scoping.test.ts`, `lead-stage-cancellation.test.ts`, the new `pipeline-terminal-stage.test.ts`).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (the one pre-existing `react-hooks/incompatible-library` warning in `questions-editor.tsx` is unrelated and may still appear).

- [ ] **Step 10: Commit**

```bash
git add lib/pipeline.ts lib/cron/stuck-leads.ts lib/cron/reconcile.ts db/queries/analytics.ts db/queries/leads.ts __tests__/pipeline-terminal-stage.test.ts
git commit -m "Centralize terminal-stage check behind lib/pipeline.ts"
```

---

## Task 2: Shrink the pipeline stage enum to 4 + lost

**Files:**
- Modify: `db/schema.ts` (`pipelineStageEnum`)
- Modify: `lib/pipeline.ts` (`STUCK_THRESHOLD_DAYS`)
- Modify: `lib/labels.ts` (`pipelineStageLabels`)
- Modify: `scripts/seed-demo.ts`
- Create: a new migration under `db/migrations/` (via `npx drizzle-kit generate`)
- Test: `__tests__/pipeline-stages.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `pipelineStageEnum.enumValues` is now exactly `["email_lead", "application_received", "contacted", "client", "lost"]`. Every later task that lists stages (kanban, filters, CRUD default stage) relies on this exact array and order.

**Note:** the existing kanban board (`components/pipeline/kanban-board.tsx`), the stage `Select` (`components/leads/stage-actions.tsx`), and the leads filter (`components/leads/lead-filters.tsx`) already iterate `pipelineStageEnum.enumValues` generically — none of them need code changes.

- [ ] **Step 1: Write the failing test**

Create `__tests__/pipeline-stages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pipelineStageEnum } from "@/db/schema";

describe("pipelineStageEnum", () => {
  it("has exactly the 4-stage-plus-lost set, in order", () => {
    expect(pipelineStageEnum.enumValues).toEqual([
      "email_lead",
      "application_received",
      "contacted",
      "client",
      "lost",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/pipeline-stages.test.ts`
Expected: FAIL — currently 7 values including `call_scheduled` and `offer_sent`.

- [ ] **Step 3: Edit `db/schema.ts`**

Change:

```ts
export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "email_lead",
  "application_received",
  "contacted",
  "call_scheduled",
  "offer_sent",
  "client",
  "lost",
]);
```

to:

```ts
export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "email_lead",
  "application_received",
  "contacted",
  "client",
  "lost",
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/pipeline-stages.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `lib/pipeline.ts`'s `STUCK_THRESHOLD_DAYS`**

Change:

```ts
export const STUCK_THRESHOLD_DAYS: Partial<Record<PipelineStage, number>> = {
  application_received: 2,
  contacted: 5,
  call_scheduled: 3,
  offer_sent: 7,
};
```

to:

```ts
export const STUCK_THRESHOLD_DAYS: Partial<Record<PipelineStage, number>> = {
  application_received: 2,
  contacted: 5,
};
```

- [ ] **Step 6: Update `lib/labels.ts`'s `pipelineStageLabels`**

Change:

```ts
export const pipelineStageLabels: Record<PipelineStage, string> = {
  email_lead: "E-poštni kontakt",
  application_received: "Prijava prejeta",
  contacted: "Kontaktiran",
  call_scheduled: "Klic dogovorjen",
  offer_sent: "Ponudba poslana",
  client: "Stranka",
  lost: "Izgubljen",
};
```

to:

```ts
export const pipelineStageLabels: Record<PipelineStage, string> = {
  email_lead: "E-poštni kontakt",
  application_received: "Prijava prejeta",
  contacted: "Kontaktiran",
  client: "Stranka",
  lost: "Izgubljen",
};
```

- [ ] **Step 7: Run typecheck to find the now-broken `scripts/seed-demo.ts`**

Run: `npx tsc --noEmit`
Expected: FAIL — `scripts/seed-demo.ts` still has a local `PipelineStage` union including `"call_scheduled" | "offer_sent"`, and two seeded leads use those literal stage values, which no longer typecheck against `leads.$inferInsert`'s narrower `stage` column type.

- [ ] **Step 8: Fix `scripts/seed-demo.ts`**

Change the local type union (around line 21-28) from:

```ts
  type PipelineStage =
    | "email_lead"
    | "application_received"
    | "contacted"
    | "call_scheduled"
    | "offer_sent"
    | "client"
    | "lost";
```

to:

```ts
  type PipelineStage = "email_lead" | "application_received" | "contacted" | "client" | "lost";
```

Change Nina Horvat's entry (was `stage: "call_scheduled"`) to:

```ts
    {
      name: "Nina Horvat",
      email: "nina.horvat@example.com",
      source: "application" as const,
      stage: "contacted" as const,
      createdAt: daysAgo(3),
      stageChangedAt: daysAgo(1),
      answers: { goal: "Splošna kondicija", experience: "Več kot 3 leta" },
    },
```

Change Luka Kranjc's entry (was `stage: "offer_sent"`, comment referenced the now-removed 7-day threshold) to:

```ts
    {
      // Stuck: contacted threshold is 5 days (lib/pipeline.ts) — this one is at 8.
      name: "Luka Kranjc",
      email: "luka.kranjc@example.com",
      source: "application" as const,
      stage: "contacted" as const,
      createdAt: daysAgo(12),
      stageChangedAt: daysAgo(8),
      answers: { goal: "Priprava na maraton", experience: "1-3 leta" },
    },
```

- [ ] **Step 9: Run typecheck again**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Generate the migration**

Ensure `.env.local` has a valid `DATABASE_URL` (required by `drizzle.config.ts`).

Run: `npx drizzle-kit generate --name shrink_pipeline_stage_enum`
Expected: a new SQL file appears under `db/migrations/` (Postgres enum value removal requires drizzle-kit to emit a create-new-enum + alter-column-using-cast + drop-old-enum sequence, since Postgres has no direct `DROP VALUE`). Open the generated file and confirm it does not attempt to cast any existing `call_scheduled`/`offer_sent` row — there are none, since this is a fresh dev database with no production data yet.

- [ ] **Step 11: Apply the migration**

Run: `npx drizzle-kit migrate`
Expected: exits 0.

- [ ] **Step 12: Run the full test suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 13: Re-seed the demo account and eyeball it**

Run: `npm run seed:demo`
Expected: exits 0, prints the demo credentials. Log in and confirm the kanban board renders exactly 5 columns (`E-poštni kontakt`, `Prijava prejeta`, `Kontaktiran`, `Stranka`, `Izgubljen`) with no leftover `call_scheduled`/`offer_sent` references anywhere in the UI.

- [ ] **Step 14: Commit**

```bash
git add db/schema.ts lib/pipeline.ts lib/labels.ts scripts/seed-demo.ts db/migrations __tests__/pipeline-stages.test.ts
git commit -m "Shrink pipeline stage enum to email_lead/application_received/contacted/client + lost"
```

---

## Task 3: Lead deduplication rewrite (email-only, cross-source merge)

**Files:**
- Modify: `db/schema.ts` (unique index on `leads`)
- Modify: `db/queries/leads.ts` (`createLeadFromIntake`)
- Create: a new migration under `db/migrations/`
- Test: `__tests__/lead-dedup.test.ts` (create)

**Interfaces:**
- Consumes: `TrainerScope` from `lib/tenant.ts`, `scoped()` from the same file.
- Produces: `createLeadFromIntake(scope, input)` keeps its existing signature (`CreateLeadFromIntakeInput` unchanged) and return shape (`{ lead: Lead; isNew: boolean }`) — only its internal conflict-handling logic changes. `app/api/leads/route.ts` needs no changes; it already calls `createLeadFromIntake` and only branches on `isNew`.

**Behavior being implemented** (per the spec's "Lead deduplication on form resubmission"):
1. Match existing leads by `(trainerId, email)` only — not `source`.
2. On conflict, always refresh `name`/`phone`.
3. If the incoming submission's `source` is `"application"`: also overwrite `answers`, merge `source` to `"application"` (even if the existing row was `lead_magnet`), and advance `stage` from `email_lead` to `application_received` — but **only** if the existing row's stage is still `email_lead`. A lead already `contacted`, `client`, or `lost` never moves.
4. A `lead_magnet` resubmission never touches `source`, `answers`, or `stage` — only `name`/`phone`.

The stage-advance condition is expressed as a single-statement Postgres `CASE` (via Drizzle's `sql` template) rather than a separate `SELECT` + `UPDATE`, since `db/index.ts` documents that the neon-http driver has no interactive `db.transaction()` — a two-statement read-then-write would have a race window between them.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lead-dedup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const updateReturningMock = vi.fn();
const onConflictDoNothingMock = vi.fn(() => ({ returning: insertReturningMock }));
const setMock = vi.fn(() => ({ where: () => ({ returning: updateReturningMock }) }));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: onConflictDoNothingMock,
      }),
    }),
    update: () => ({ set: setMock }),
  },
}));

import { createLeadFromIntake } from "@/db/queries/leads";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "site_key_ingest");

beforeEach(() => {
  insertReturningMock.mockReset();
  updateReturningMock.mockReset();
  onConflictDoNothingMock.mockClear();
  setMock.mockClear();
});

describe("createLeadFromIntake", () => {
  it("targets the (trainerId, email) unique index on conflict", async () => {
    insertReturningMock.mockResolvedValue([{ id: "lead-1", email: "a@example.com" }]);

    await createLeadFromIntake(scope, {
      email: "a@example.com",
      source: "application",
      stage: "application_received",
    });

    expect(onConflictDoNothingMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
    const target = onConflictDoNothingMock.mock.calls[0][0].target;
    expect(target).toHaveLength(2);
  });

  it("returns isNew: true and never updates when the insert succeeds", async () => {
    insertReturningMock.mockResolvedValue([{ id: "lead-1", email: "a@example.com" }]);

    const result = await createLeadFromIntake(scope, {
      email: "a@example.com",
      source: "application",
      stage: "application_received",
    });

    expect(result.isNew).toBe(true);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("on a conflict, always refreshes name and phone only", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-2", email: "b@example.com" }]);

    const result = await createLeadFromIntake(scope, {
      name: "Nova Ime",
      email: "b@example.com",
      phone: "041123456",
      source: "lead_magnet",
      stage: "email_lead",
    });

    expect(result.isNew).toBe(false);
    expect(setMock).toHaveBeenCalledWith({ name: "Nova Ime", phone: "041123456" });
  });

  it("on a conflicting application submission, also merges source and answers", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-3", email: "c@example.com" }]);

    await createLeadFromIntake(scope, {
      name: "Ana",
      email: "c@example.com",
      source: "application",
      stage: "application_received",
      answers: { goal: "Shujšati" },
    });

    const setArg = setMock.mock.calls[0][0];
    expect(setArg.name).toBe("Ana");
    expect(setArg.source).toBe("application");
    expect(setArg.answers).toEqual({ goal: "Shujšati" });
    // The stage field is a Postgres CASE expression (SQL fragment) — its
    // *runtime* correctness (only advances out of email_lead) is not
    // verifiable against a mocked db and must be checked manually against a
    // real database; see this task's Step 8.
    expect(setArg.stage).toBeDefined();
  });

  it("on a conflicting lead_magnet submission, never includes source, answers, or stage in the update", async () => {
    insertReturningMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([{ id: "lead-4", email: "d@example.com" }]);

    await createLeadFromIntake(scope, {
      email: "d@example.com",
      source: "lead_magnet",
      stage: "email_lead",
    });

    const setArg = setMock.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("source");
    expect(setArg).not.toHaveProperty("answers");
    expect(setArg).not.toHaveProperty("stage");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lead-dedup.test.ts`
Expected: FAIL — the current implementation targets `[leads.trainerId, leads.email, leads.source]` and always sets exactly `{ name, phone, answers }` regardless of `source`.

- [ ] **Step 3: Edit the unique index in `db/schema.ts`**

Change:

```ts
    // Makes public ingest an upsert: a repeat submission (same trainer/email/source)
    // updates the existing lead instead of creating a duplicate, and — because
    // scheduling only fires on a genuine insert — can't double-schedule a sequence.
    uniqueIndex("leads_trainer_id_email_source_unique").on(t.trainerId, t.email, t.source),
```

to:

```ts
    // Makes public ingest an upsert: a repeat submission (same trainer/email)
    // updates the existing lead instead of creating a duplicate, and —
    // because scheduling only fires on a genuine insert — can't
    // double-schedule a sequence. Matched by email alone (not email+source):
    // a lead_magnet contact who later submits the full application form
    // merges into the same row rather than creating a second one — see
    // createLeadFromIntake in db/queries/leads.ts.
    uniqueIndex("leads_trainer_id_email_unique").on(t.trainerId, t.email),
```

- [ ] **Step 4: Rewrite `createLeadFromIntake` in `db/queries/leads.ts`**

Add `sql` to the drizzle-orm import at the top of the file:

```ts
import { and, desc, eq, gte, isNull, notExists, notInArray, sql } from "drizzle-orm";
```

Replace the whole `createLeadFromIntake` function and its docstring with:

```ts
/**
 * Upsert on (trainerId, email) — see the unique index in db/schema.ts. A
 * repeat submission from the same person (regardless of source) updates the
 * existing row instead of creating a duplicate, and — because the caller
 * only schedules an email sequence when `isNew` is true — can't
 * double-schedule one either.
 *
 * Implemented as insert-with-onConflictDoNothing, then a follow-up update on
 * conflict, rather than a single onConflictDoUpdate: this makes "was it a
 * genuine insert" a plain JS boolean instead of a Postgres `xmax = 0` trick.
 *
 * Stage handling on conflict, per CLAUDE.md's "Lead deduplication on form
 * resubmission": only an incoming `application` submission can change
 * `stage`, and only by advancing out of `email_lead` into
 * `application_received` — a lead already `contacted`, `client`, or `lost`
 * must never move backward on the kanban board just because the form was
 * filled out again. A `lead_magnet` resubmission never touches `stage`,
 * `source`, or `answers` — it can only refresh `name`/`phone`. An
 * `application` resubmission additionally merges `source` to `application`
 * and overwrites `answers`, even if the existing row was `lead_magnet` — one
 * email is one lead, regardless of which form it came through.
 */
export async function createLeadFromIntake(
  scope: TrainerScope,
  input: CreateLeadFromIntakeInput,
): Promise<CreateLeadFromIntakeResult> {
  const [inserted] = await db
    .insert(leads)
    .values({
      trainerId: scope.trainerId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      stage: input.stage,
      answers: input.answers,
    })
    .onConflictDoNothing({ target: [leads.trainerId, leads.email] })
    .returning();

  if (inserted) {
    return { lead: inserted, isNew: true };
  }

  const [updated] = await db
    .update(leads)
    .set(
      input.source === "application"
        ? {
            name: input.name,
            phone: input.phone,
            source: "application" as const,
            answers: input.answers,
            stage: sql`CASE WHEN ${leads.stage} = 'email_lead' THEN 'application_received'::pipeline_stage ELSE ${leads.stage} END`,
          }
        : {
            name: input.name,
            phone: input.phone,
          },
    )
    .where(scoped(leads, scope, eq(leads.email, input.email)))
    .returning();

  return { lead: updated, isNew: false };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/lead-dedup.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full test suite, typecheck, and lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 7: Generate and apply the migration**

Run: `npx drizzle-kit generate --name lead_email_only_unique_index`
Expected: a new migration file replacing the 3-column unique index with the 2-column one. Since there's no production data yet, this cannot fail on a pre-existing duplicate — note for the future: if real `(trainerId, email)` duplicates ever exist by the time this runs against a populated database (e.g. the same person as both a `lead_magnet` and an `application` row), the migration will fail on the new unique constraint and those rows must be merged manually first.

Run: `npx drizzle-kit migrate`
Expected: exits 0.

- [ ] **Step 8: Manually verify the CASE expression against a real database**

This is the one behavior the mocked unit tests in Step 1 cannot verify (Postgres, not JS, evaluates the `CASE`). Using `npm run seed:demo` data or a fresh local trainer, `POST` to `/api/leads` (or call `createLeadFromIntake` directly in a scratch script) with a payload matching an existing `email_lead` lead's email and `source: "application"` — confirm the row's `stage` becomes `application_received`. Repeat against an existing `contacted` lead's email — confirm `stage` stays `contacted`. Repeat with `source: "lead_magnet"` against an existing lead — confirm `stage` never changes.

- [ ] **Step 9: Commit**

```bash
git add db/schema.ts db/queries/leads.ts db/migrations __tests__/lead-dedup.test.ts
git commit -m "Rewrite lead dedup: match by email only, cross-source merge, conditional stage advance"
```

---

## Task 4: Full CRUD for the "Stranke" tab

**Files:**
- Modify: `db/queries/leads.ts` (add `createLead`, `updateLead`, `deleteLead`)
- Create: `lib/validation/leads.ts`
- Modify: `lib/actions/leads.ts` (add `createLeadAction`, `updateLeadAction`, `deleteLeadAction`)
- Modify: `lib/strings.ts` (new `sl.leads` keys)
- Create: `components/leads/create-lead-dialog.tsx`
- Create: `components/leads/edit-lead-dialog.tsx`
- Create: `components/leads/delete-lead-button.tsx`
- Modify: `app/(dashboard)/leads/page.tsx` (mount `CreateLeadDialog`)
- Modify: `app/(dashboard)/leads/[id]/page.tsx` (mount `EditLeadDialog` + `DeleteLeadButton`)
- Test: `__tests__/lead-crud.test.ts` (create)

**Interfaces:**
- Consumes: `TrainerScope`, `scoped()` from `lib/tenant.ts`; `ActionResult` type already defined in `lib/actions/leads.ts`; `cancelSequenceForLead` from `lib/email/cancel.ts` (already imported in this file for `stopSequenceAction`).
- Produces:
  - `lib/validation/leads.ts` exports `manualLeadSchema: ZodObject` and `type ManualLeadInput = { name?: string; email: string; phone?: string }`.
  - `db/queries/leads.ts` adds `createLead(scope, ManualLeadInput): Promise<Lead>`, `updateLead(scope, leadId, ManualLeadInput): Promise<Lead | null>`, `deleteLead(scope, leadId): Promise<boolean>`.
  - `lib/actions/leads.ts` adds `createLeadAction(input: ManualLeadInput): Promise<ActionResult>`, `updateLeadAction(leadId, input: ManualLeadInput): Promise<ActionResult>`, `deleteLeadAction(leadId): Promise<ActionResult>`. `ActionResult["error"]` gains the value `"duplicateEmail"` alongside the existing `"unexpected"`/`"validation"`/`"notFound"` strings used elsewhere in the codebase.

**Design note — deletion must cancel outstanding sequence emails first.** `leads` cascade-deletes its `scheduled_emails` rows, but that only removes the local record — it does **not** cancel the email at Resend. Deleting a lead without first calling `cancelSequenceForLead` would leave an orphaned Resend-side scheduled send with no local row left to explain or cancel it later. `deleteLeadAction` therefore calls `cancelSequenceForLead` before `deleteLead`.

- [ ] **Step 1: Write the failing tests for the query layer**

Create `__tests__/lead-crud.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertReturningMock = vi.fn();
const updateReturningMock = vi.fn();
const deleteReturningMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: () => ({ returning: insertReturningMock }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: updateReturningMock }) }) }),
    delete: () => ({ where: () => ({ returning: deleteReturningMock }) }),
  },
}));

import { createLead, deleteLead, updateLead } from "@/db/queries/leads";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  insertReturningMock.mockReset();
  updateReturningMock.mockReset();
  deleteReturningMock.mockReset();
});

describe("createLead", () => {
  it("creates a manually-added lead starting at email_lead / application source", async () => {
    insertReturningMock.mockResolvedValue([
      { id: "lead-1", name: "Ana", email: "ana@example.com", stage: "email_lead", source: "application" },
    ]);

    const lead = await createLead(scope, { name: "Ana", email: "ana@example.com" });

    expect(lead.stage).toBe("email_lead");
    expect(lead.source).toBe("application");
  });
});

describe("updateLead", () => {
  it("returns the updated lead when found", async () => {
    updateReturningMock.mockResolvedValue([{ id: "lead-1", name: "Nova", email: "nova@example.com" }]);

    const lead = await updateLead(scope, "lead-1", { name: "Nova", email: "nova@example.com" });

    expect(lead?.name).toBe("Nova");
  });

  it("returns null when the lead doesn't exist or isn't owned by this trainer", async () => {
    updateReturningMock.mockResolvedValue([]);

    const lead = await updateLead(scope, "lead-1", { email: "x@example.com" });

    expect(lead).toBeNull();
  });
});

describe("deleteLead", () => {
  it("returns true when a row was deleted", async () => {
    deleteReturningMock.mockResolvedValue([{ id: "lead-1" }]);

    expect(await deleteLead(scope, "lead-1")).toBe(true);
  });

  it("returns false when nothing was deleted", async () => {
    deleteReturningMock.mockResolvedValue([]);

    expect(await deleteLead(scope, "lead-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lead-crud.test.ts`
Expected: FAIL — `createLead`/`updateLead`/`deleteLead` are not exported from `db/queries/leads.ts` yet.

- [ ] **Step 3: Add the three query functions to `db/queries/leads.ts`**

Append at the end of the file:

```ts
export interface ManualLeadInput {
  name?: string;
  email: string;
  phone?: string;
}

/** A trainer manually adding a lead always starts it cold, at the same entry
 *  point as a lead_magnet capture — see CLAUDE.md's pipeline stages. */
export async function createLead(scope: TrainerScope, input: ManualLeadInput): Promise<Lead> {
  const [lead] = await db
    .insert(leads)
    .values({
      trainerId: scope.trainerId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: "application",
      stage: "email_lead",
    })
    .returning();
  return lead;
}

export async function updateLead(
  scope: TrainerScope,
  leadId: string,
  input: ManualLeadInput,
): Promise<Lead | null> {
  const [updated] = await db
    .update(leads)
    .set({ name: input.name, email: input.email, phone: input.phone })
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .returning();
  return updated ?? null;
}

/** Returns whether a row was actually deleted. Caller is responsible for
 *  canceling outstanding sequence emails first — see deleteLeadAction in
 *  lib/actions/leads.ts — since the scheduled_emails cascade delete here
 *  only removes the local record, not the Resend-side scheduled send. */
export async function deleteLead(scope: TrainerScope, leadId: string): Promise<boolean> {
  const rows = await db
    .delete(leads)
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .returning();
  return rows.length > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lead-crud.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the validation schema**

Create `lib/validation/leads.ts`:

```ts
import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

/** The manually-added-lead / edit-lead form contract — distinct from
 *  lib/validation/lead-intake.ts, which is the public API contract. */
export const manualLeadSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
  phone: z.string().trim().max(50).optional(),
});

export type ManualLeadInput = z.infer<typeof manualLeadSchema>;
```

- [ ] **Step 6: Add the three Server Actions to `lib/actions/leads.ts`**

Add these imports at the top, alongside the existing ones:

```ts
import { createLead, deleteLead, updateLead } from "@/db/queries/leads";
import { cancelSequenceForLead } from "@/lib/email/cancel";
import { manualLeadSchema, type ManualLeadInput } from "@/lib/validation/leads";
```

(`setLeadStage` and `cancelSequenceForLead` are already imported in this file for the existing actions — only add what's missing.)

Append at the end of the file:

```ts
export async function createLeadAction(input: ManualLeadInput): Promise<ActionResult> {
  const parsed = manualLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  try {
    await createLead(scope, parsed.data);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      return { ok: false, error: "duplicateEmail" };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function updateLeadAction(leadId: string, input: ManualLeadInput): Promise<ActionResult> {
  const parsed = manualLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  try {
    const updated = await updateLead(scope, leadId, parsed.data);
    if (!updated) {
      return { ok: false, error: "notFound" };
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      return { ok: false, error: "duplicateEmail" };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

/** Cancels any outstanding sequence emails before the row (and its
 *  scheduled_emails rows) disappear via cascade delete — otherwise Resend
 *  still sends them with no local record left to explain why. */
export async function deleteLeadAction(leadId: string): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  await cancelSequenceForLead(scope, leadId);
  const deleted = await deleteLead(scope, leadId);
  if (!deleted) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}
```

- [ ] **Step 7: Add the new `sl.leads` strings**

In `lib/strings.ts`, inside the existing `leads: { ... }` object, add these keys (anywhere inside the object, e.g. after `unsubscribedNotice`):

```ts
    addLead: "Dodaj stranko",
    editLead: "Uredi",
    saveLead: "Shrani",
    createSuccess: "Stranka je bila dodana.",
    updateSuccess: "Spremembe so bile shranjene.",
    duplicateEmail: "Stranka s tem e-poštnim naslovom že obstaja.",
    deleteLead: "Izbriši stranko",
    deleteLeadConfirmTitle: "Izbriši stranko?",
    deleteLeadConfirmBody:
      "Tega dejanja ni mogoče razveljaviti. Izbrisani bodo tudi vsi zapiski in načrtovana e-sporočila za to stranko.",
    cancelButton: "Prekliči",
```

- [ ] **Step 8: Create `components/leads/create-lead-dialog.tsx`**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeadAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";
import { manualLeadSchema, type ManualLeadInput } from "@/lib/validation/leads";

export function CreateLeadDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualLeadInput>({ resolver: zodResolver(manualLeadSchema) });

  async function onSubmit(values: ManualLeadInput) {
    setIsSubmitting(true);
    const result = await createLeadAction(values);
    setIsSubmitting(false);
    if (!result.ok) {
      toast.error(result.error === "duplicateEmail" ? sl.leads.duplicateEmail : sl.errors.validation);
      return;
    }
    toast.success(sl.leads.createSuccess);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>{sl.leads.addLead}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.leads.addLead}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.columnName}</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.columnEmail}</Label>
            <Input {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.phoneLabel}</Label>
            <Input {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {sl.leads.saveLead}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 9: Create `components/leads/edit-lead-dialog.tsx`**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLeadAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";
import { manualLeadSchema, type ManualLeadInput } from "@/lib/validation/leads";

export function EditLeadDialog({ leadId, defaultValues }: { leadId: string; defaultValues: ManualLeadInput }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualLeadInput>({ resolver: zodResolver(manualLeadSchema), defaultValues });

  async function onSubmit(values: ManualLeadInput) {
    setIsSubmitting(true);
    const result = await updateLeadAction(leadId, values);
    setIsSubmitting(false);
    if (!result.ok) {
      toast.error(result.error === "duplicateEmail" ? sl.leads.duplicateEmail : sl.errors.validation);
      return;
    }
    toast.success(sl.leads.updateSuccess);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{sl.leads.editLead}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.leads.editLead}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.columnName}</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.columnEmail}</Label>
            <Input {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.phoneLabel}</Label>
            <Input {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {sl.leads.saveLead}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 10: Create `components/leads/delete-lead-button.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteLeadAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteLeadAction(leadId);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
        return;
      }
      setOpen(false);
      router.push("/leads");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>{sl.leads.deleteLead}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.leads.deleteLeadConfirmTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{sl.leads.deleteLeadConfirmBody}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {sl.leads.cancelButton}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {sl.leads.deleteLead}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 11: Mount `CreateLeadDialog` on `app/(dashboard)/leads/page.tsx`**

Add the import:

```ts
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
```

Change the header row from:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.leads.title}</h1>
        <LeadFilters currentStage={stage} currentSource={source} />
      </div>
```

to:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.leads.title}</h1>
        <div className="flex items-center gap-2">
          <LeadFilters currentStage={stage} currentSource={source} />
          <CreateLeadDialog />
        </div>
      </div>
```

- [ ] **Step 12: Mount `EditLeadDialog` and `DeleteLeadButton` on `app/(dashboard)/leads/[id]/page.tsx`**

Add the imports:

```ts
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog";
```

Change:

```tsx
        <StageActions leadId={lead.id} currentStage={lead.stage} />
```

to:

```tsx
        <div className="flex items-center gap-2">
          <StageActions leadId={lead.id} currentStage={lead.stage} />
          <EditLeadDialog
            leadId={lead.id}
            defaultValues={{ name: lead.name ?? undefined, email: lead.email, phone: lead.phone ?? undefined }}
          />
          <DeleteLeadButton leadId={lead.id} />
        </div>
```

- [ ] **Step 13: Run the full test suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 14: Manually verify in the browser**

Run: `npm run dev`, log in with the demo account. On `/leads`: click "Dodaj stranko", submit a new lead, confirm it appears in the table at `email_lead`/`Prijava` stage. Try creating a second lead with the same email — confirm the duplicate-email error toast appears. On `/leads/[id]`: edit the lead's name, confirm the toast and updated header; delete the lead, confirm redirect to `/leads` and the row is gone.

- [ ] **Step 15: Commit**

```bash
git add db/queries/leads.ts lib/validation/leads.ts lib/actions/leads.ts lib/strings.ts components/leads/create-lead-dialog.tsx components/leads/edit-lead-dialog.tsx components/leads/delete-lead-button.tsx "app/(dashboard)/leads/page.tsx" "app/(dashboard)/leads/[id]/page.tsx" __tests__/lead-crud.test.ts
git commit -m "Add full CRUD (create/edit/delete) for the Stranke tab"
```

---

## Task 5: New tab — "Izpolnjene forme" (`/applications`)

**Files:**
- Create: `app/(dashboard)/applications/page.tsx`
- Modify: `lib/strings.ts` (new `sl.applications` section, new `sl.nav.applications` key)
- Modify: `app/(dashboard)/layout.tsx` (nav link)

**Interfaces:**
- Consumes: `listLeads(scope, { source: "application" })` (existing, unchanged), `getTrainer(scope)` (existing), `AnswersView` component (existing, unchanged), `pipelineStageLabels` (existing).
- Produces: route `/applications`, reachable from the sidebar.

No new query or component is needed — this tab is a read-only recombination of existing pieces.

- [ ] **Step 1: Add the new strings**

In `lib/strings.ts`, add `applications` to `sl.nav`:

```ts
  nav: {
    leads: "Stranke",
    pipeline: "Cevovod",
    applications: "Izpolnjene forme",
    emails: "Emaili",
    analytics: "Analitika",
    settings: "Nastavitve",
    logout: "Odjava",
  },
```

(This also adds the `emails` key that Task 6 will use — adding both now avoids a second edit to the same object.)

Add a new top-level `applications` section to the `sl` object (e.g. after the `pipeline` section):

```ts
  applications: {
    title: "Izpolnjene forme",
    empty: "Ni še nobene izpolnjene prijave.",
  },
```

- [ ] **Step 2: Create `app/(dashboard)/applications/page.tsx`**

```tsx
import Link from "next/link";
import { AnswersView } from "@/components/leads/answers-view";
import { listLeads } from "@/db/queries/leads";
import { getTrainer } from "@/db/queries/trainers";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function ApplicationsPage() {
  const scope = await requireTrainer();
  const [applications, trainer] = await Promise.all([
    listLeads(scope, { source: "application" }),
    getTrainer(scope),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{sl.applications.title}</h1>
      {applications.length === 0 ? (
        <p className="text-muted-foreground">{sl.applications.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {applications.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                  {lead.name ?? lead.email}
                </Link>
                <span className="text-sm text-muted-foreground">{pipelineStageLabels[lead.stage]}</span>
              </div>
              <AnswersView answers={lead.answers} questions={trainer?.applicationQuestions ?? []} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link in `app/(dashboard)/layout.tsx`**

Change:

```tsx
          <Link href="/pipeline" className="text-sm font-medium">
            {sl.nav.pipeline}
          </Link>
          <Link href="/analytics" className="text-sm font-medium">
            {sl.nav.analytics}
          </Link>
```

to:

```tsx
          <Link href="/pipeline" className="text-sm font-medium">
            {sl.nav.pipeline}
          </Link>
          <Link href="/applications" className="text-sm font-medium">
            {sl.nav.applications}
          </Link>
          <Link href="/analytics" className="text-sm font-medium">
            {sl.nav.analytics}
          </Link>
```

- [ ] **Step 4: Typecheck, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Manually verify**

Run: `npm run dev`, log in with the demo account, click "Izpolnjene forme" in the sidebar. Confirm it lists only `source: "application"` leads with their answers rendered (including the "archived answers" case for Eva Zupan's `legacy_question`), and that clicking a name navigates to `/leads/[id]`.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/applications/page.tsx" "app/(dashboard)/layout.tsx" lib/strings.ts
git commit -m "Add Izpolnjene forme (/applications) dashboard tab"
```

---

## Task 6: New tab — "Emaili" (`/emails`)

**Files:**
- Modify: `db/queries/scheduled-emails.ts` (add `listScheduledEmailsForTrainer`)
- Modify: `lib/labels.ts` (add `scheduledEmailStatusLabels`)
- Create: `components/emails/cancel-sequence-button.tsx`
- Create: `app/(dashboard)/emails/page.tsx`
- Modify: `lib/strings.ts` (new `sl.emails` section)
- Modify: `app/(dashboard)/layout.tsx` (nav link)
- Test: `__tests__/scheduled-emails-list.test.ts` (create)

**Interfaces:**
- Consumes: `TrainerScope`, `scoped()` from `lib/tenant.ts`; `stopSequenceAction(leadId)` (existing, from `lib/actions/leads.ts`).
- Produces: `listScheduledEmailsForTrainer(scope: TrainerScope): Promise<ScheduledEmailWithLead[]>` where `ScheduledEmailWithLead extends ScheduledEmail` adds `leadName: string | null` and `leadEmail: string`. Route `/emails`, reachable from the sidebar.

- [ ] **Step 1: Write the failing test**

Create `__tests__/scheduled-emails-list.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const orderByMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => orderByMock(),
          }),
        }),
      }),
    }),
  },
}));

import { listScheduledEmailsForTrainer } from "@/db/queries/scheduled-emails";
import { systemScope } from "@/lib/tenant";

const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

beforeEach(() => {
  orderByMock.mockReset();
});

describe("listScheduledEmailsForTrainer", () => {
  it("returns rows joined with the lead's name and email", async () => {
    orderByMock.mockResolvedValue([
      {
        id: "se-1",
        leadId: "lead-1",
        sequenceStep: "application_day0_confirmation",
        status: "scheduled",
        leadName: "Ana Kovač",
        leadEmail: "ana@example.com",
      },
    ]);

    const rows = await listScheduledEmailsForTrainer(scope);

    expect(rows).toHaveLength(1);
    expect(rows[0].leadName).toBe("Ana Kovač");
    expect(rows[0].leadEmail).toBe("ana@example.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/scheduled-emails-list.test.ts`
Expected: FAIL — `listScheduledEmailsForTrainer` doesn't exist yet.

- [ ] **Step 3: Add `listScheduledEmailsForTrainer` to `db/queries/scheduled-emails.ts`**

Change the imports at the top of the file from:

```ts
import { and, count, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { scheduledEmails, type NewScheduledEmail, type ScheduledEmail } from "@/db/schema";
```

to:

```ts
import { and, count, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { leads, scheduledEmails, type NewScheduledEmail, type ScheduledEmail } from "@/db/schema";
```

Append at the end of the file:

```ts
export interface ScheduledEmailWithLead extends ScheduledEmail {
  leadName: string | null;
  leadEmail: string;
}

/** Powers the /emails dashboard tab — every scheduled_emails row for this
 *  trainer, joined with the lead's display name/email. */
export async function listScheduledEmailsForTrainer(scope: TrainerScope): Promise<ScheduledEmailWithLead[]> {
  return db
    .select({
      id: scheduledEmails.id,
      trainerId: scheduledEmails.trainerId,
      leadId: scheduledEmails.leadId,
      sequenceStep: scheduledEmails.sequenceStep,
      resendEmailId: scheduledEmails.resendEmailId,
      scheduledFor: scheduledEmails.scheduledFor,
      status: scheduledEmails.status,
      sentAt: scheduledEmails.sentAt,
      canceledAt: scheduledEmails.canceledAt,
      lastError: scheduledEmails.lastError,
      createdAt: scheduledEmails.createdAt,
      updatedAt: scheduledEmails.updatedAt,
      leadName: leads.name,
      leadEmail: leads.email,
    })
    .from(scheduledEmails)
    .innerJoin(leads, eq(scheduledEmails.leadId, leads.id))
    .where(scoped(scheduledEmails, scope))
    .orderBy(desc(scheduledEmails.scheduledFor));
}
```

Note: `scoped`/`TrainerScope` are already imported in this file (`import { scoped, type TrainerScope } from "@/lib/tenant";`) — no change needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/scheduled-emails-list.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `scheduledEmailStatusLabels` to `lib/labels.ts`**

Add the import:

```ts
import type { ScheduledEmailStatus } from "@/db/types";
```

Append at the end of the file:

```ts
export const scheduledEmailStatusLabels: Record<ScheduledEmailStatus, string> = {
  pending: "V pripravi",
  scheduled: "Načrtovano",
  sent: "Poslano",
  canceled: "Preklicano",
  orphaned: "Osirotelo",
  cancel_failed: "Napaka pri preklicu",
};
```

- [ ] **Step 6: Add the `sl.emails` strings**

In `lib/strings.ts`, add a new top-level `emails` section (e.g. after `applications`, added in Task 5):

```ts
  emails: {
    title: "Emaili",
    empty: "Ni še nobenega načrtovanega e-sporočila.",
    columnLead: "Stranka",
    columnStep: "Korak",
    columnStatus: "Status",
    columnScheduledFor: "Datum",
    cancelButton: "Prekliči",
  },
```

- [ ] **Step 7: Create `components/emails/cancel-sequence-button.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { stopSequenceAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";

export function CancelSequenceButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await stopSequenceAction(leadId);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
        return;
      }
      toast.success(sl.leads.stopSequenceConfirm);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {sl.emails.cancelButton}
    </Button>
  );
}
```

- [ ] **Step 8: Create `app/(dashboard)/emails/page.tsx`**

```tsx
import { CancelSequenceButton } from "@/components/emails/cancel-sequence-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listScheduledEmailsForTrainer } from "@/db/queries/scheduled-emails";
import { scheduledEmailStatusLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EmailsPage() {
  const scope = await requireTrainer();
  const emails = await listScheduledEmailsForTrainer(scope);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{sl.emails.title}</h1>
      {emails.length === 0 ? (
        <p className="text-muted-foreground">{sl.emails.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{sl.emails.columnLead}</TableHead>
              <TableHead>{sl.emails.columnStep}</TableHead>
              <TableHead>{sl.emails.columnStatus}</TableHead>
              <TableHead>{sl.emails.columnScheduledFor}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((email) => (
              <TableRow key={email.id}>
                <TableCell>{email.leadName ?? email.leadEmail}</TableCell>
                <TableCell>{email.sequenceStep}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{scheduledEmailStatusLabels[email.status]}</Badge>
                </TableCell>
                <TableCell>{email.scheduledFor.toLocaleString("sl-SI")}</TableCell>
                <TableCell>
                  {(email.status === "scheduled" || email.status === "pending") && (
                    <CancelSequenceButton leadId={email.leadId} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Add the nav link in `app/(dashboard)/layout.tsx`**

Change:

```tsx
          <Link href="/applications" className="text-sm font-medium">
            {sl.nav.applications}
          </Link>
          <Link href="/analytics" className="text-sm font-medium">
            {sl.nav.analytics}
          </Link>
```

to:

```tsx
          <Link href="/applications" className="text-sm font-medium">
            {sl.nav.applications}
          </Link>
          <Link href="/emails" className="text-sm font-medium">
            {sl.nav.emails}
          </Link>
          <Link href="/analytics" className="text-sm font-medium">
            {sl.nav.analytics}
          </Link>
```

- [ ] **Step 10: Run the full test suite, typecheck, lint, and build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 11: Manually verify**

Run: `npm run dev`, log in with the demo account, click "Emaili" in the sidebar. Confirm the table lists scheduled emails with status badges and a working "Prekliči" button on non-terminal rows (note: the demo-seeded leads have no real `scheduled_emails` rows unless `RESEND_API_KEY` was configured when they were created — an empty state here is expected without a live Resend key; verify against a lead created through a real `/api/leads` POST with Resend configured, if available).

- [ ] **Step 12: Commit**

```bash
git add db/queries/scheduled-emails.ts lib/labels.ts components/emails/cancel-sequence-button.tsx "app/(dashboard)/emails/page.tsx" "app/(dashboard)/layout.tsx" lib/strings.ts __tests__/scheduled-emails-list.test.ts
git commit -m "Add Emaili (/emails) dashboard tab"
```

---

## Task 7: Settings restructure — Vprašanja moves to `/settings/questions`

**Files:**
- Create: `app/(dashboard)/settings/questions/page.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `QuestionsEditor` (existing, unchanged), `SiteKeyCard` (existing, unchanged), `getTrainer` (existing).
- Produces: route `/settings/questions`.

`QuestionsEditor` itself needs no changes — only which page mounts it.

- [ ] **Step 1: Create `app/(dashboard)/settings/questions/page.tsx`**

```tsx
import { QuestionsEditor } from "@/components/settings/questions-editor";
import { getTrainer } from "@/db/queries/trainers";
import { requireTrainer } from "@/lib/tenant";

export default async function SettingsQuestionsPage() {
  const scope = await requireTrainer();
  const trainer = await getTrainer(scope);
  if (!trainer) return null; // requireTrainer() already guarantees a trainer row exists

  return <QuestionsEditor initialQuestions={trainer.applicationQuestions} />;
}
```

- [ ] **Step 2: Rewrite `app/(dashboard)/settings/page.tsx`**

Full new file content:

```tsx
import Link from "next/link";
import { SiteKeyCard } from "@/components/settings/site-key-card";
import { getTrainer } from "@/db/queries/trainers";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function SettingsPage() {
  const scope = await requireTrainer();
  const trainer = await getTrainer(scope);
  if (!trainer) return null; // requireTrainer() already guarantees a trainer row exists

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{sl.settings.title}</h1>
      <SiteKeyCard siteKey={trainer.siteKey} />
      <Link href="/settings/questions" className="text-sm font-medium hover:underline">
        {sl.settings.questionsTitle} &rarr;
      </Link>
    </div>
  );
}
```

(A plain link rather than a `Tabs`-based sub-nav — this is a two-page settings section, and `components/ui/tabs.tsx` would need extra client-side logic to sync the active tab with the URL for no real benefit here. Revisit if a third settings sub-page is ever added.)

- [ ] **Step 3: Run typecheck, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass. (No test needed — this task is pure page composition of already-tested/unchanged components.)

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, log in with the demo account, go to `/settings`. Confirm it shows only the site-key card and a "Vprašanja v prijavnem obrazcu →" link; clicking it goes to `/settings/questions` and shows the working question editor (add/edit/delete/save a question).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/settings/questions/page.tsx" "app/(dashboard)/settings/page.tsx"
git commit -m "Move Vprasanja editor to /settings/questions"
```

---

## Plan Self-Review

**Spec coverage:**
- Pipeline enum shrink → Task 2. ✅
- Terminal-stage consolidation (the "future direction" addition) → Task 1. ✅
- Lead dedup rewrite (email-only, cross-source merge, conditional stage advance) → Task 3. ✅
- Full lead CRUD → Task 4. ✅
- `/applications` tab → Task 5. ✅
- `/emails` tab → Task 6. ✅
- Settings restructure → Task 7. ✅
- Testing section (typecheck/lint/build gates, manual verification of stage transitions, dedup, CRUD, new tabs, re-running `seed:demo`) → folded into each task's own verification steps rather than a separate end-of-plan task, so each task stays independently testable per this skill's Task Right-Sizing rule.
- "Out of scope" / future per-trainer-configurable stages → correctly not represented by any task.

**Type consistency check:** `ManualLeadInput` is defined once in `lib/validation/leads.ts` (Task 4) via `z.infer<typeof manualLeadSchema>` and referenced by that exact import path in `db/queries/leads.ts`, `lib/actions/leads.ts`, `create-lead-dialog.tsx`, and `edit-lead-dialog.tsx` — no divergent redefinition. `ScheduledEmailWithLead` (Task 6) is defined once in `db/queries/scheduled-emails.ts` and consumed only by `app/(dashboard)/emails/page.tsx`. `TERMINAL_STAGES`/`isTerminalStage` (Task 1) names are used identically at every one of the five call-site replacements.

**Placeholder scan:** no TBD/TODO markers; every step shows complete file content or an exact diff, not a description of one.

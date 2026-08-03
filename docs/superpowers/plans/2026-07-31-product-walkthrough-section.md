# Product Walkthrough Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Attio-style "sticky steps" walkthrough section to the public landing page — a fixed left-hand list of 5 product steps that highlights whichever one the visitor has scrolled to, while the right column shows a small looping, app-styled animation per step.

**Architecture:** Two new colocated client components under `app/(public)/_components/`: `product-walkthrough-frames.tsx` (a shared `AppFrame` chrome + 5 small focused Framer Motion animations, each gated by an `isActive` prop) and `product-walkthrough.tsx` (the section shell — copy data, two-column layout, `IntersectionObserver`-driven active-step state, mobile fallback). Wired into `page.tsx` right after `Hero` and into `navbar.tsx`'s scroll-spy nav links. `mechanism.tsx` and `product-tour.tsx` are untouched.

**Tech Stack:** Next.js (App Router), Tailwind v4, Framer Motion (already used throughout `app/(public)/_components/**`), lucide-react icons, existing `lib/labels.ts` / `lib/badge-styles.ts` / `lib/pipeline.ts` / `lib/display.ts` helpers, `Counter` from `counter.tsx`.

**Spec:** `docs/superpowers/specs/2026-07-31-product-walkthrough-section-design.md`

## Global Constraints

- UI text is Slovenian (project language convention); code/comments/identifiers are English.
- `"use client"` only where genuinely interactive (both new files need it — hooks + `IntersectionObserver`).
- No new dependencies — Framer Motion, lucide-react, and every `lib/**` helper referenced below are already installed/present.
- No real data, no network calls, no connection to `db/queries/**` — same decorative-only rule as `hero-demo.tsx`. Only `LeadSource`/`PipelineStage`/`ScheduledEmailStatus` **types** are imported (from `@/db/schema` and `@/db/types`), never live queries.
- Reuse existing design tokens/helpers only — no invented colors, badge shapes, or label strings. `lib/labels.ts` and `lib/badge-styles.ts` are exhaustive `Record<enum, ...>` maps; index them with real enum values, never string literals typed as `any`.
- Respect `useReducedMotion()` for anything that moves/translates (position or size changes) — reduce to a fast `{ duration: 0.2 }` transition, matching the existing pattern in `hero-demo.tsx`. Plain CSS color/ring transitions (not translation) don't need gating.
- `mechanism.tsx` and `product-tour.tsx` must not be modified.
- Run `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` before declaring the work done.

---

### Task 1: `AppFrame` shared chrome, `useStageLoop` hook, and `CaptureFrame`

**Files:**
- Create: `app/(public)/_components/product-walkthrough-frames.tsx`
- Test: none (pure UI, verified via typecheck — same convention as `hero-demo.tsx`, which also has no test file)

**Interfaces:**
- Produces: `AppFrame({ children, className }: { children: ReactNode; className?: string })` — every later frame wraps its content in this.
- Produces: `useStageLoop<T extends string>(stages: readonly T[], durations: Record<T, number>, isActive: boolean): { stage: T; cycle: number }` (module-private, not exported — used by every frame in this file). Advances `stage` on a `setTimeout` chain while `isActive`; freezes on `stages[0]` and resets its internal counter when `isActive` is false, so a step re-entering the viewport always restarts its animation from the same beat. `cycle` increments every full pass through `stages` (available if a later frame needs to force-replay an entrance animation via a React `key`).
- Produces: `CaptureFrame({ isActive }: { isActive: boolean })`. Task 6 renders it for the `"capture"` step.

- [ ] **Step 1: Write the file**

`app/(public)/_components/product-walkthrough-frames.tsx`:
```tsx
"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Same "fake browser chrome" visual language as hero-demo.tsx's outer
 *  wrapper, extracted here so all 5 step visuals read as one consistent
 *  app window. */
export function AppFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-80 overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10 shadow-2xl shadow-foreground/10",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 z-20 flex h-6 items-center gap-1.5 border-b bg-muted/40 px-3">
        <span className="size-2 rounded-full bg-destructive/40" />
        <span className="size-2 rounded-full bg-hot/40" />
        <span className="size-2 rounded-full bg-success/40" />
      </div>
      <div className="absolute inset-0 top-6">{children}</div>
    </div>
  );
}

/** Advances through `stages` on a timer while `isActive`; freezes on the
 *  first stage while inactive. Deliberately does NOT reset its internal
 *  counter itself on deactivation — this repo's `react-hooks/refs` and
 *  `react-hooks/set-state-in-effect` lint rules reject both a ref-based
 *  reset-on-prop-change and a direct `setState` call in an effect body, so
 *  "always restart from the same beat" is instead achieved by the caller
 *  (Task 6's `renderFrame`) remounting the component via a `key` that
 *  changes across the inactive/active boundary — a fresh mount's
 *  `useState(0)` naturally starts at 0, no reset logic needed here. `cycle`
 *  counts full passes through `stages`, for callers that need to
 *  force-replay a mount-only entrance animation via a React `key`. */
function useStageLoop<T extends string>(
  stages: readonly T[],
  durations: Record<T, number>,
  isActive: boolean,
): { stage: T; cycle: number } {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const currentStage = stages[tick % stages.length];
    const timer = setTimeout(() => {
      setTick((t) => t + 1);
    }, durations[currentStage]);
    return () => clearTimeout(timer);
  }, [isActive, tick, stages, durations]);

  return {
    stage: stages[isActive ? tick % stages.length : 0],
    cycle: Math.floor(tick / stages.length),
  };
}

/** Reduces any motion/size transition to a fast opacity-only-feeling snap
 *  when the user prefers reduced motion — same rule hero-demo.tsx applies. */
function withReducedMotion(reduceMotion: boolean, transition: Transition): Transition {
  return reduceMotion ? { duration: 0.2 } : transition;
}

type CaptureStage = "empty" | "filling" | "submit" | "hold";
const CAPTURE_STAGES: readonly CaptureStage[] = ["empty", "filling", "submit", "hold"];
const CAPTURE_DURATIONS: Record<CaptureStage, number> = {
  empty: 600,
  filling: 1600,
  submit: 700,
  hold: 1400,
};

const CAPTURE_FIELDS = [
  { id: "name", label: "Ime", answer: "Nika Kralj" },
  { id: "goal", label: "Kakšen je tvoj cilj?", answer: "Shujšati 5 kg" },
  { id: "availability", label: "Kdaj si na voljo?", answer: "Popoldne med tednom" },
] as const;

export function CaptureFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { stage } = useStageLoop(CAPTURE_STAGES, CAPTURE_DURATIONS, isActive);
  const filled = stage === "filling" || stage === "submit" || stage === "hold";

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-3 px-5 py-4">
        <div>
          <p className="text-[13px] font-semibold">Prijavi se</p>
          <p className="text-[9px] text-muted-foreground">Izpolni formo in se ti oglasim v 24 urah</p>
        </div>
        <div className="flex flex-col gap-2">
          {CAPTURE_FIELDS.map((field, i) => (
            <div key={field.id} className="flex flex-col gap-0.5">
              <span className="text-[9px] text-muted-foreground">{field.label}</span>
              <div className="flex items-center rounded-md border px-2 py-1">
                <motion.span
                  className="text-[10px] font-medium"
                  animate={{ opacity: filled ? 1 : 0, x: filled ? 0 : -4 }}
                  transition={withReducedMotion(reduceMotion, { duration: 0.4, delay: i * 0.35, ease: EASE })}
                >
                  {filled ? field.answer : ""}
                </motion.span>
                {!filled && <span className="text-[10px] text-muted-foreground/50">Vpiši odgovor…</span>}
              </div>
            </div>
          ))}
        </div>
        <motion.div
          className="mt-auto w-fit rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground"
          animate={stage === "submit" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={withReducedMotion(reduceMotion, { duration: 0.5 })}
        >
          Pošlji prijavo
        </motion.div>
      </div>
    </AppFrame>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/product-walkthrough-frames.tsx"
git commit -m "feat: add AppFrame shell and capture-step animation for product walkthrough"
```

---

### Task 2: `OrganizeFrame`

**Files:**
- Modify: `app/(public)/_components/product-walkthrough-frames.tsx` (append)

**Interfaces:**
- Consumes: `AppFrame`, `withReducedMotion` (already in the file from Task 1, no `useReducedMotion` needed here since this frame only uses a plain CSS ring transition, not translation).
- Produces: `OrganizeFrame({ isActive }: { isActive: boolean })`. Task 6 renders it for the `"organize"` step.

- [ ] **Step 1: Add the imports this step needs**

At the top of `app/(public)/_components/product-walkthrough-frames.tsx`, add:
```tsx
import type { LeadSource, PipelineStage } from "@/db/schema";
import { leadSourceBadgeClasses, pipelineStageDotClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
```

- [ ] **Step 2: Append the component**

Append to `app/(public)/_components/product-walkthrough-frames.tsx`:
```tsx
interface OrganizeLead {
  name: string;
  email: string;
  source: LeadSource;
  stage: PipelineStage;
}

const ORGANIZE_LEADS: readonly OrganizeLead[] = [
  { name: "Nika Kralj", email: "nika.kralj@example.com", source: "application", stage: "application_received" },
  { name: "Bojan Vidič", email: "bojan.vidic@example.com", source: "lead_magnet", stage: "email_lead" },
  { name: "Maja Novak", email: "maja.novak@example.com", source: "application", stage: "contacted" },
  { name: "Rok Kovačič", email: "rok.kovacic@example.com", source: "lead_magnet", stage: "client" },
];

type OrganizeStage = "idle" | "highlight" | "hold";
const ORGANIZE_STAGES: readonly OrganizeStage[] = ["idle", "highlight", "hold"];
const ORGANIZE_DURATIONS: Record<OrganizeStage, number> = { idle: 1000, highlight: 1600, hold: 1000 };

export function OrganizeFrame({ isActive }: { isActive: boolean }) {
  const { stage } = useStageLoop(ORGANIZE_STAGES, ORGANIZE_DURATIONS, isActive);
  const highlighted = stage !== "idle";

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-1.5 px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">Stranke</p>
        <div className="flex flex-col gap-1.5">
          {ORGANIZE_LEADS.map((lead, i) => (
            <div
              key={lead.email}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 transition-shadow duration-300",
                highlighted && i === 0 && "ring-2 ring-primary/50",
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-medium",
                    avatarTintClass(lead.email),
                  )}
                >
                  {initials(lead.name, lead.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-medium">{lead.name}</p>
                  <p className="truncate text-[7.5px] text-muted-foreground">{lead.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={cn("rounded px-1 text-[6.5px] leading-[1.4]", leadSourceBadgeClasses[lead.source])}>
                  {leadSourceLabels[lead.source]}
                </span>
                <span className="flex items-center gap-1 text-[7px] text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", pipelineStageDotClasses[lead.stage])} />
                  {pipelineStageLabels[lead.stage]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/_components/product-walkthrough-frames.tsx"
git commit -m "feat: add organize-step animation for product walkthrough"
```

---

### Task 3: `KanbanFrame`

**Files:**
- Modify: `app/(public)/_components/product-walkthrough-frames.tsx` (append)

**Interfaces:**
- Consumes: `AppFrame`, `useStageLoop`, `EASE` (already in file). Uses a distinct `layoutId` (`"walkthrough-kanban-card"`) from `hero-demo.tsx`'s `"hero-demo-ana-card"` — both components can be mounted simultaneously on the page without a Framer Motion shared-layout collision.
- Produces: `KanbanFrame({ isActive }: { isActive: boolean })`. Task 6 renders it for the `"kanban"` step.

- [ ] **Step 1: Add the imports this step needs**

At the top of `app/(public)/_components/product-walkthrough-frames.tsx`, add:
```tsx
import { AnimatePresence } from "framer-motion";
import { CheckCircle2, GripVertical } from "lucide-react";
```
(Merge `AnimatePresence` into the existing `framer-motion` import from Task 1, i.e. the import line becomes `import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";`.)

- [ ] **Step 2: Append the component**

Append to `app/(public)/_components/product-walkthrough-frames.tsx`:
```tsx
interface KanbanCard {
  name: string;
  email: string;
}

const KANBAN_CARD: KanbanCard = { name: "Nika Kralj", email: "nika.kralj@example.com" };
const KANBAN_FILLERS: Partial<Record<PipelineStage, KanbanCard[]>> = {
  contacted: [{ name: "Maja Novak", email: "maja.novak@example.com" }],
  client: [{ name: "Rok Kovačič", email: "rok.kovacic@example.com" }],
};
const KANBAN_COLUMNS: readonly PipelineStage[] = ["application_received", "contacted", "client"];

type KanbanStage = "col-1" | "col-2" | "col-3" | "hold";
const KANBAN_STAGES: readonly KanbanStage[] = ["col-1", "col-2", "col-3", "hold"];
const KANBAN_DURATIONS: Record<KanbanStage, number> = { "col-1": 900, "col-2": 1000, "col-3": 1000, hold: 1300 };
const KANBAN_COLUMN_FOR_STAGE: Record<KanbanStage, PipelineStage> = {
  "col-1": "application_received",
  "col-2": "contacted",
  "col-3": "client",
  hold: "client",
};

export function KanbanFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { stage } = useStageLoop(KANBAN_STAGES, KANBAN_DURATIONS, isActive);
  const cardColumn = KANBAN_COLUMN_FOR_STAGE[stage];
  const showSuccess = stage === "col-3" || stage === "hold";

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-1.5 px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">Kanban pregled</p>
        <div className="grid grow grid-cols-3 gap-1.5">
          {KANBAN_COLUMNS.map((col) => {
            const fillers = KANBAN_FILLERS[col] ?? [];
            const cardHere = cardColumn === col;
            return (
              <div key={col} className="flex flex-col gap-1 rounded-md bg-muted/40 p-1.5">
                <div className="flex items-center gap-1">
                  <span className={cn("size-1.5 shrink-0 rounded-full", pipelineStageDotClasses[col])} />
                  <span className="truncate text-[7.5px] font-medium text-muted-foreground">
                    {pipelineStageLabels[col]}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {fillers.map((card) => (
                    <div key={card.email} className="rounded-md border bg-background px-1.5 py-1">
                      <KanbanCardBody card={card} />
                    </div>
                  ))}
                  <AnimatePresence>
                    {cardHere && (
                      <motion.div
                        layoutId="walkthrough-kanban-card"
                        className="relative rounded-md border bg-background px-1.5 py-1 ring-1 ring-primary/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          layout: withReducedMotion(reduceMotion, { duration: 0.8, ease: EASE }),
                          opacity: { duration: 0.3 },
                        }}
                      >
                        <KanbanCardBody card={KANBAN_CARD} success={showSuccess} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppFrame>
  );
}

function KanbanCardBody({ card, success }: { card: KanbanCard; success?: boolean }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-medium",
              avatarTintClass(card.email),
            )}
          >
            {initials(card.name, card.email)}
          </span>
          <span className="truncate text-[8px] font-medium">{card.name}</span>
        </div>
        <GripVertical className="size-2.5 shrink-0 text-muted-foreground/40" />
      </div>
      <AnimatePresence>
        {success && (
          <motion.span
            className="absolute -top-1 -right-1 text-success"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <CheckCircle2 className="size-3" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/_components/product-walkthrough-frames.tsx"
git commit -m "feat: add kanban-step animation for product walkthrough"
```

---

### Task 4: `EmailFrame`

**Files:**
- Modify: `app/(public)/_components/product-walkthrough-frames.tsx` (append)

**Interfaces:**
- Consumes: `AppFrame`, `useStageLoop`, `withReducedMotion`, `EASE`, `AnimatePresence`, `motion` (already in file).
- Produces: `EmailFrame({ isActive }: { isActive: boolean })`. Task 6 renders it for the `"email"` step.

- [ ] **Step 1: Add the imports this step needs**

At the top of `app/(public)/_components/product-walkthrough-frames.tsx`, add:
```tsx
import type { ScheduledEmailStatus } from "@/db/types";
import { scheduledEmailStatusBadgeClasses } from "@/lib/badge-styles";
import { scheduledEmailStatusLabels } from "@/lib/labels";
import { Mail } from "lucide-react";
```
(Merge `Mail` into the existing `lucide-react` import from Task 3, i.e. `import { CheckCircle2, GripVertical, Mail } from "lucide-react";`.)

- [ ] **Step 2: Append the component**

Append to `app/(public)/_components/product-walkthrough-frames.tsx`:
```tsx
interface SequenceStep {
  label: string;
  status: ScheduledEmailStatus;
}

type EmailStage = "before" | "sending" | "after" | "hold";
const EMAIL_STAGES: readonly EmailStage[] = ["before", "sending", "after", "hold"];
const EMAIL_DURATIONS: Record<EmailStage, number> = { before: 900, sending: 900, after: 500, hold: 1600 };
const EMAIL_STEP_LABELS = ["Dan 0 · Dobrodošlica", "Dan 2 · Opomnik", "Dan 5 · Zadnja priložnost"] as const;

export function EmailFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { stage } = useStageLoop(EMAIL_STAGES, EMAIL_DURATIONS, isActive);
  const secondStatus: ScheduledEmailStatus = stage === "before" ? "scheduled" : "sent";
  const steps: SequenceStep[] = [
    { label: EMAIL_STEP_LABELS[0], status: "sent" },
    { label: EMAIL_STEP_LABELS[1], status: secondStatus },
    { label: EMAIL_STEP_LABELS[2], status: "pending" },
  ];

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-2 px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">Email sekvenca</p>
        <div className="relative flex flex-col gap-2">
          {steps.map((step) => (
            <div
              key={step.label}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
            >
              <span className="text-[9px] font-medium">{step.label}</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[7px]", scheduledEmailStatusBadgeClasses[step.status])}>
                {scheduledEmailStatusLabels[step.status]}
              </span>
            </div>
          ))}
          <AnimatePresence>
            {stage === "sending" && (
              <motion.div
                className="absolute top-8 right-2 text-primary"
                initial={{ opacity: 0, scale: 0.6, y: 0 }}
                animate={{ opacity: [0, 1, 1, 0], scale: 1, y: -18 }}
                exit={{ opacity: 0 }}
                transition={withReducedMotion(reduceMotion, { duration: 0.9, ease: EASE })}
              >
                <Mail className="size-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppFrame>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/_components/product-walkthrough-frames.tsx"
git commit -m "feat: add email-automation-step animation for product walkthrough"
```

---

### Task 5: `AnalyticsFrame`

**Files:**
- Modify: `app/(public)/_components/product-walkthrough-frames.tsx` (append)

**Interfaces:**
- Consumes: `AppFrame`, `useStageLoop`, `withReducedMotion`, `EASE`, `motion`, `useReducedMotion` (already in file); `Counter` from `@/app/(public)/_components/counter`.
- Produces: `AnalyticsFrame({ isActive }: { isActive: boolean })`. Task 6 renders it for the `"analytics"` step.

- [ ] **Step 1: Add the import this step needs**

At the top of `app/(public)/_components/product-walkthrough-frames.tsx`, add:
```tsx
import { Counter } from "@/app/(public)/_components/counter";
```

- [ ] **Step 2: Append the component**

Append to `app/(public)/_components/product-walkthrough-frames.tsx`:
```tsx
type AnalyticsStage = "grow" | "hold";
const ANALYTICS_STAGES: readonly AnalyticsStage[] = ["grow", "hold"];
const ANALYTICS_DURATIONS: Record<AnalyticsStage, number> = { grow: 1200, hold: 1400 };
const BAR_HEIGHTS: readonly number[] = [65, 85, 55, 95];
const BAR_LABELS = ["1. teden", "2. teden", "3. teden", "4. teden"] as const;

export function AnalyticsFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { cycle } = useStageLoop(ANALYTICS_STAGES, ANALYTICS_DURATIONS, isActive);

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-3 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Stopnja konverzije</p>
          <Counter to={34} suffix="%" className="text-lg font-semibold text-foreground" />
        </div>
        <div key={cycle} className="flex grow gap-3 pb-1">
          {BAR_HEIGHTS.map((pct, i) => (
            <div key={BAR_LABELS[i]} className="flex grow flex-col items-center justify-end gap-1">
              <motion.div
                className="w-full rounded-t-sm bg-primary/70"
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={withReducedMotion(reduceMotion, { duration: 1, ease: EASE })}
              />
              <span className="shrink-0 text-[7px] text-muted-foreground">{BAR_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </AppFrame>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. This also completes `product-walkthrough-frames.tsx` — confirm all 5 exports (`AppFrame`, `CaptureFrame`, `OrganizeFrame`, `KanbanFrame`, `EmailFrame`, `AnalyticsFrame`) are present with no unused-import lint errors (run `npm run lint` too at this point since Tasks 1-4 each added imports incrementally).

Run: `npm run lint`
Expected: PASS, no unused-import warnings.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/_components/product-walkthrough-frames.tsx"
git commit -m "feat: add analytics-step animation for product walkthrough"
```

**Note (discovered during execution):** this repo's eslint config includes React Compiler's `react-hooks/refs` (no ref read *or* write during render) and `react-hooks/set-state-in-effect` (no direct `setState` call in an effect body) rules. Task 1's original `useStageLoop` violated the latter with its `if (!isActive) { setTick(0); return; }` reset branch — not caught by Task 1's review since that review only ran `npm run typecheck`, not `npm run lint`. The fix (found and verified during Task 5's execution, across several rejected attempts — a ref-comparison-during-render approach and an eslint-disable both failed) removes the reset branch entirely; `useStageLoop` above and Task 6's `renderFrame` below reflect the corrected design. See the ledger for the full back-and-forth.

---

### Task 6: `ProductWalkthrough` section shell

**Files:**
- Create: `app/(public)/_components/product-walkthrough.tsx`

**Interfaces:**
- Consumes: `Container` from `@/app/(public)/_components/container`; `CaptureFrame`, `OrganizeFrame`, `KanbanFrame`, `EmailFrame`, `AnalyticsFrame` from Tasks 1-5 (`@/app/(public)/_components/product-walkthrough-frames`).
- Produces: `ProductWalkthrough(): JSX.Element` from `@/app/(public)/_components/product-walkthrough`, a section with `id="sistem"`. Task 7 renders `<ProductWalkthrough />` right after `<Hero />`.

- [ ] **Step 1: Write the component**

`app/(public)/_components/product-walkthrough.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/app/(public)/_components/container";
import {
  AnalyticsFrame,
  CaptureFrame,
  EmailFrame,
  KanbanFrame,
  OrganizeFrame,
} from "@/app/(public)/_components/product-walkthrough-frames";
import { cn } from "@/lib/utils";

/** Keying each frame by its own on/off state forces React to remount it
 *  across the inactive/active boundary, so useStageLoop's internal timer
 *  state always starts fresh at 0 on (re)activation — the "always restart
 *  from the same beat" behavior is achieved via remount, not via any reset
 *  logic inside the hook itself (which would require reading/writing a ref
 *  during render or calling setState synchronously in an effect body, both
 *  of which this repo's react-hooks/refs and react-hooks/set-state-in-effect
 *  lint rules reject). A typed lookup (rather than a string-keyed switch
 *  with a `default: return null`) also means an unmapped step id is a
 *  compile error, not a silent blank frame. */
const FRAMES = {
  capture: CaptureFrame,
  organize: OrganizeFrame,
  kanban: KanbanFrame,
  email: EmailFrame,
  analytics: AnalyticsFrame,
} as const;

type StepId = keyof typeof FRAMES;

interface WalkthroughStep {
  id: StepId;
  title: string;
  description: string;
}

const STEPS: readonly WalkthroughStep[] = [
  {
    id: "capture",
    title: "Zajem strank",
    description: "Prijavna forma na tvoji strani samodejno zabeleži vsako povpraševanje — brez ročnega vnašanja.",
  },
  {
    id: "organize",
    title: "Organizacija leadov",
    description: "Vsaka stranka pristane na enem seznamu — ime, e-pošta, vir in faza na prvi pogled.",
  },
  {
    id: "kanban",
    title: "Kanban pregled",
    description: "Povleci in spusti stranko skozi faze — od povpraševanja do plačljive stranke.",
  },
  {
    id: "email",
    title: "Email avtomatizacije",
    description: "Sistem sam pošilja follow-up sporočila, dokler stranka ne odgovori ali konvertira.",
  },
  {
    id: "analytics",
    title: "Analitika",
    description: "Spremljaj stopnjo konverzije in vir povpraševanj skozi čas.",
  },
] as const;

export function ProductWalkthrough() {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const index = stepRefs.current.findIndex((el) => el === visible.target);
        if (index !== -1) setActiveIndex(index);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="sistem" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Sistem</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          En sistem, od prvega klika do plačljive stranke
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-[380px_1fr] lg:gap-16">
          <div className="hidden lg:sticky lg:top-32 lg:block lg:h-fit">
            <ul className="flex flex-col gap-6">
              {STEPS.map((step, i) => (
                <li key={step.id}>
                  <p
                    className={cn(
                      "text-lg font-semibold transition-colors duration-300",
                      i === activeIndex ? "text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {step.title}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm transition-colors duration-300",
                      i === activeIndex ? "text-muted-foreground" : "text-muted-foreground/30",
                    )}
                  >
                    {step.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-16 lg:gap-24">
            {STEPS.map((step, i) => {
              const isActive = i === activeIndex;
              const Frame = FRAMES[step.id];
              return (
                <div
                  key={step.id}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="flex min-h-[70vh] flex-col justify-center gap-4 lg:min-h-screen"
                >
                  <div className="lg:hidden">
                    <p className="text-lg font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <Frame key={isActive ? "on" : "off"} isActive={isActive} />
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/product-walkthrough.tsx"
git commit -m "feat: add product walkthrough section shell with sticky scroll-spy"
```

---

### Task 7: Wire the section into the page and navbar

**Files:**
- Modify: `app/(public)/page.tsx`
- Modify: `app/(public)/_components/navbar.tsx:19-25`

**Interfaces:**
- Consumes: `ProductWalkthrough` from Task 6.

- [ ] **Step 1: Insert the section into the page, right after `Hero`**

In `app/(public)/page.tsx`, add the import (alphabetically among the existing `@/app/(public)/_components/*` imports):
```tsx
import { ProductWalkthrough } from "@/app/(public)/_components/product-walkthrough";
```

Then change:
```tsx
        <Hero />
        <Reveal>
          <Mechanism />
        </Reveal>
```
to:
```tsx
        <Hero />
        <Reveal>
          <ProductWalkthrough />
        </Reveal>
        <Reveal>
          <Mechanism />
        </Reveal>
```

- [ ] **Step 2: Add the nav link**

In `app/(public)/_components/navbar.tsx`, change:
```tsx
const navLinks = [
  { href: "#kako-deluje", label: "Kako deluje" },
  { href: "#produkt", label: "Produkt" },
  { href: "#bonusi", label: "Bonusi" },
  { href: "#cenik", label: "Cenik" },
  { href: "#faq", label: "FAQ" },
];
```
to:
```tsx
const navLinks = [
  { href: "#sistem", label: "Sistem" },
  { href: "#kako-deluje", label: "Kako deluje" },
  { href: "#produkt", label: "Produkt" },
  { href: "#bonusi", label: "Bonusi" },
  { href: "#cenik", label: "Cenik" },
  { href: "#faq", label: "FAQ" },
];
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: Both PASS with no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/page.tsx" "app/(public)/_components/navbar.tsx"
git commit -m "feat: wire product walkthrough section into the landing page and nav"
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full check suite**

Run: `npm run build && npm run typecheck && npm run lint && npm test`
Expected: All four PASS.

- [ ] **Step 2: Manual browser walkthrough**

Start the dev server (`npm run dev`) and use browser automation (chrome-devtools MCP) to visit `http://localhost:3000/`:
1. `resize_page` to a desktop width (e.g. 1440x900).
2. Scroll into the `#sistem` section and confirm the left-hand step list stays pinned in place (`position: sticky`) as you continue scrolling — specifically verify it does **not** unpin or jump immediately after the section's Framer Motion entrance (`Reveal`) fade-in finishes. If it does unpin/misbehave, that confirms the `Reveal` wrapper's transform is interfering with the sticky child — fix by rendering `<ProductWalkthrough />` directly in `page.tsx` without the `<Reveal>` wrapper (this section already has its own scroll-driven motion, so losing the entrance fade is an acceptable trade-off) and re-verify.
3. Confirm the active step's title in the left list is bold/dark while the other four are visibly muted, and that the highlighted item changes as you scroll from step 1 through step 5.
4. Confirm each of the 5 right-column animations plays (form fields filling, a lead row highlighting, a kanban card hopping columns with a checkmark, an email sequence step ticking to "sent" with an envelope icon, and the analytics bars/counter animating) and loops continuously while its step is in view.
5. Click the new "Sistem" navbar link and confirm it scroll-jumps to the section and becomes the active/underlined nav item.
6. Resize to a mobile width (e.g. 390x844) and confirm the sticky left list is hidden, each step shows its own inline title+description above its animation, and nothing overflows horizontally.
7. Emulate `prefers-reduced-motion: reduce` (via `emulate` or OS-level settings) and confirm the kanban card, mail icon, and analytics bars snap quickly instead of sliding/growing over a full second.

- [ ] **Step 3: Fix any issues found, then final commit**

If Step 2 surfaces a visual bug (including the sticky/Reveal interaction called out above), fix it in the relevant file and commit the fix separately (`fix: ...`) rather than folding it silently into an earlier task's commit.

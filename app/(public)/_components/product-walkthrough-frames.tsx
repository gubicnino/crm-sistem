"use client";

import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LeadSource, PipelineStage } from "@/db/schema";
import { leadSourceBadgeClasses, pipelineStageDotClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import type { ScheduledEmailStatus } from "@/db/types";
import { scheduledEmailStatusBadgeClasses } from "@/lib/badge-styles";
import { scheduledEmailStatusLabels } from "@/lib/labels";
import { CheckCircle2, GripVertical, Mail } from "lucide-react";
import { Counter } from "@/app/(public)/_components/counter";

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

/** Advances through `stages` on a timer while `isActive`. While inactive,
 *  the displayed `stage` is forced to `stages[0]`, but the internal `tick`
 *  counter itself is NOT reset — so reactivating without an accompanying
 *  remount would resume from wherever `tick` left off, not restart at 0.
 *  Callers that need a true "always restart from the same beat on
 *  reactivation" guarantee must force a remount via a `key` that changes
 *  across the inactive/active boundary (see product-walkthrough.tsx's
 *  `renderFrame`). `cycle` counts full passes through `stages`. */
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

interface OrganizeLead {
  name: string;
  email: string;
  source: LeadSource;
  stage: PipelineStage;
}

const ORGANIZE_LEADS: readonly OrganizeLead[] = [
  { name: "Nika Kralj", email: "nika.kralj@example.com", source: "application", stage: "application_received" },
  { name: "Bojan Vidic", email: "bojan.vidic@example.com", source: "lead_magnet", stage: "email_lead" },
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

type AnalyticsStage = "low" | "high";
const ANALYTICS_STAGES: readonly AnalyticsStage[] = ["low", "high"];
const ANALYTICS_DURATIONS: Record<AnalyticsStage, number> = { low: 1300, high: 1300 };
const BAR_HEIGHTS: Record<AnalyticsStage, readonly number[]> = {
  low: [30, 45, 25, 50],
  high: [65, 85, 55, 95],
};
const BAR_LABELS = ["Tedn 1", "Tedn 2", "Tedn 3", "Tedn 4"] as const;

export function AnalyticsFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { stage } = useStageLoop(ANALYTICS_STAGES, ANALYTICS_DURATIONS, isActive);
  const heights = BAR_HEIGHTS[stage];

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-3 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Stopnja konverzije</p>
          <Counter to={34} suffix="%" className="text-lg font-semibold text-foreground" />
        </div>
        <div className="flex grow gap-3 pb-1">
          {heights.map((pct, i) => (
            <div key={BAR_LABELS[i]} className="flex grow flex-col items-center justify-end gap-1">
              <motion.div
                className="w-full rounded-t-sm bg-primary/70"
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

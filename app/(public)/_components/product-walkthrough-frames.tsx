"use client";

import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { CheckCircle2, ChevronDown, GripVertical, Mail } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { LeadSource, PipelineStage } from "@/db/schema";
import type { ScheduledEmailStatus } from "@/db/types";
import {
  leadSourceBadgeClasses,
  pipelineStageBadgeClasses,
  pipelineStageDotClasses,
  scheduledEmailStatusBadgeClasses,
} from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { leadSourceLabels, pipelineStageLabels, scheduledEmailStatusLabels } from "@/lib/labels";
import { ACTIVE_PIPELINE_STAGES } from "@/lib/pipeline";
import { sl } from "@/lib/strings";
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

/** Advances through `stages` on a timer while `isActive`. While inactive,
 *  the displayed `stage` is forced to `stages[0]`, but the internal `tick`
 *  counter itself is NOT reset — so reactivating without an accompanying
 *  remount would resume from wherever `tick` left off, not restart at 0.
 *  Callers that need a true "always restart from the same beat on
 *  reactivation" guarantee must force a remount via a `key` that changes
 *  across the inactive/active boundary (see product-walkthrough.tsx's
 *  `FRAMES` lookup). `cycle` counts full passes through `stages`. */
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

type CaptureFieldType = "text" | "select" | "textarea" | "checkbox";

interface CaptureField {
  id: string;
  label: string;
  type: CaptureFieldType;
  options?: readonly string[];
  answer: string;
}

/** Mirrors hero-demo.tsx's FORM_FIELDS verbatim (same real applicationQuestions
 *  from scripts/seed-demo.ts, same seeded Ana Kovač answers plus the same 4
 *  plausible invented ones) so this step shows the exact same form-fill
 *  animation as the hero, not a simplified re-derivation of it. */
const CAPTURE_FIELDS: readonly CaptureField[] = [
  { id: "goal", label: "Kakšen je tvoj cilj?", type: "text", answer: "Shujšati 5 kg" },
  {
    id: "experience",
    label: "Koliko časa že treniraš?",
    type: "select",
    options: ["Manj kot leto", "1-3 leta", "Več kot 3 leta"],
    answer: "Manj kot leto",
  },
  { id: "availability", label: "Kdaj si na voljo za treninge?", type: "text", answer: "Popoldne med tednom" },
  { id: "injuries", label: "Imaš kakšne poškodbe ali zdravstvene omejitve?", type: "textarea", answer: "Ne, nimam." },
  {
    id: "location",
    label: "Kje bi rad treniral?",
    type: "select",
    options: ["V fitnesu", "Na prostem", "Doma"],
    answer: "V fitnesu",
  },
  { id: "newsletter", label: "Se želiš prijaviti na e-novice z nasveti za trening?", type: "checkbox", answer: "Da" },
];

type CaptureStage = "empty" | "filling" | "submit" | "hold";
const CAPTURE_STAGES: readonly CaptureStage[] = ["empty", "filling", "submit", "hold"];
const CAPTURE_DURATIONS: Record<CaptureStage, number> = {
  empty: 700,
  filling: 1900,
  submit: 700,
  hold: 1400,
};

export function CaptureFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { stage } = useStageLoop(CAPTURE_STAGES, CAPTURE_DURATIONS, isActive);
  const filled = stage === "filling" || stage === "submit" || stage === "hold";

  return (
    <AppFrame className="h-105">
      <div className="flex h-full flex-col gap-2 overflow-hidden px-5 py-3">
        <div>
          <p className="text-[13px] font-semibold">Prijavi se</p>
          <p className="text-[9px] text-muted-foreground">Izpolni formo in se ti oglasim v 24 urah</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {CAPTURE_FIELDS.map((field, i) => (
            <CaptureFieldRow key={field.id} field={field} filled={filled} delay={i * 0.5} reduceMotion={reduceMotion} />
          ))}
        </div>
        <motion.div
          className="mt-1 w-fit rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground"
          animate={stage === "submit" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={withReducedMotion(reduceMotion, { duration: 0.5 })}
        >
          Pošlji prijavo
        </motion.div>
      </div>
    </AppFrame>
  );
}

function CaptureFieldRow({
  field,
  filled,
  delay,
  reduceMotion,
}: {
  field: CaptureField;
  filled: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const transition = withReducedMotion(reduceMotion, { duration: 0.5, delay, ease: EASE });
  const showValue = filled && field.answer;

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "flex size-2.5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-300",
            showValue ? "border-primary bg-primary" : "border-border bg-transparent",
          )}
        >
          <motion.span
            className="text-[6px] leading-none font-bold text-primary-foreground"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: showValue ? 1 : 0, scale: showValue ? 1 : 0.5 }}
            transition={transition}
          >
            ✓
          </motion.span>
        </span>
        <span className="text-[8px] text-muted-foreground">{field.label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] text-muted-foreground">{field.label}</span>
      {field.type === "select" ? (
        <div className="flex items-center justify-between rounded-md border px-1.5 py-0.5">
          <motion.span
            className="text-[9px] font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: showValue ? 1 : 0 }}
            transition={transition}
          >
            {showValue ? field.answer : ""}
          </motion.span>
          {!showValue && <span className="text-[9px] text-muted-foreground/50">Izberi…</span>}
          <ChevronDown className="size-2.5 shrink-0 text-muted-foreground" />
        </div>
      ) : (
        <div className={cn("flex items-center rounded-md border px-1.5 py-0.5", field.type === "textarea" && "h-5")}>
          <motion.span
            className="text-[9px] font-medium"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: showValue ? 1 : 0, x: showValue ? 0 : -4 }}
            transition={transition}
          >
            {showValue ? field.answer : ""}
          </motion.span>
          {!showValue && <span className="text-[9px] text-muted-foreground/50">Vpiši odgovor…</span>}
        </div>
      )}
    </div>
  );
}

interface OrganizeLead {
  name: string;
  email: string;
  source: LeadSource;
  stage: PipelineStage;
  createdLabel: string;
}

/** Real seeded leads from scripts/seed-demo.ts (same names/emails/dates a
 *  trainer would actually see on /leads), laid out with the same columns
 *  and badge colors as the real table (components/leads/**, lib/badge-styles.ts). */
const ORGANIZE_LEADS: readonly OrganizeLead[] = [
  {
    name: "Sara Golob",
    email: "sara.golob@example.com",
    source: "lead_magnet",
    stage: "email_lead",
    createdLabel: "31. 7. 2026",
  },
  {
    name: "Maja Turk",
    email: "maja.turk@example.com",
    source: "application",
    stage: "application_received",
    createdLabel: "31. 7. 2026",
  },
  {
    name: "Ana Kovač",
    email: "ana.kovac@example.com",
    source: "application",
    stage: "application_received",
    createdLabel: "30. 7. 2026",
  },
];

/** Ana Kovač's real answers from scripts/seed-demo.ts, in the same order the
 *  real /leads/[id] page renders them (components/leads/answers-view.tsx). */
const ANA_ANSWERS = [
  { label: "Kakšen je tvoj cilj?", value: "Shujšati 5 kg" },
  { label: "Imaš kakšne poškodbe ali zdravstvene omejitve?", value: "Blaga bolečina v kolenu, brez omejitev za hojo" },
  { label: "Kje bi rad treniral?", value: "V fitnesu" },
  { label: "Koliko časa že treniraš?", value: "Manj kot leto" },
  { label: "Se želiš prijaviti na e-novice z nasveti za trening?", value: "Da" },
  { label: "Kdaj si na voljo za treninge?", value: "Ponedeljek in sreda zvečer" },
] as const;

type OrganizeStage = "table" | "clicking" | "detail";
const ORGANIZE_STAGES: readonly OrganizeStage[] = ["table", "clicking", "detail"];
const ORGANIZE_DURATIONS: Record<OrganizeStage, number> = { table: 1700, clicking: 500, detail: 2600 };

export function OrganizeFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { stage } = useStageLoop(ORGANIZE_STAGES, ORGANIZE_DURATIONS, isActive);
  const showDetail = stage === "detail";
  const fadeTransition = withReducedMotion(reduceMotion, { duration: 0.5, ease: EASE });

  return (
    <AppFrame className="h-100">
      {/* Stranke table */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-2 overflow-hidden px-4 py-3"
        animate={{ opacity: showDetail ? 0 : 1 }}
        transition={fadeTransition}
      >
        <p className="text-[11px] font-medium text-muted-foreground">Stranke</p>
        <div className="flex flex-col overflow-hidden rounded-md border">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1 text-[6.5px] font-medium text-muted-foreground">
            <span className="w-[22%]">Ime</span>
            <span className="w-[23%]">E-pošta</span>
            <span className="w-[13%]">Vir</span>
            <span className="w-[13%]">Faza</span>
            <span className="w-[15%]">Ustvarjeno</span>
            <span className="w-[14%] text-right">Akcije</span>
          </div>
          {ORGANIZE_LEADS.map((lead) => (
            <div
              key={lead.email}
              className={cn(
                "flex items-center gap-2 border-b px-2 py-1.5 transition-colors duration-300 last:border-b-0",
                stage === "clicking" && lead.name === "Ana Kovač" && "bg-primary/5 ring-1 ring-inset ring-primary/40",
              )}
            >
              <div className="flex w-[22%] min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full text-[6.5px] font-medium",
                    avatarTintClass(lead.email),
                  )}
                >
                  {initials(lead.name, lead.email)}
                </span>
                <span className="truncate text-[7.5px] font-medium">{lead.name}</span>
              </div>
              <span className="w-[23%] truncate text-[6.5px] text-muted-foreground">{lead.email}</span>
              <span className="w-[13%]">
                <span
                  className={cn(
                    "rounded-full px-1 py-0.5 text-[6px] font-medium",
                    leadSourceBadgeClasses[lead.source],
                  )}
                >
                  {leadSourceLabels[lead.source]}
                </span>
              </span>
              <span className="w-[13%]">
                <span
                  className={cn("rounded-full px-1 py-0.5 text-[6px] font-medium", pipelineStageBadgeClasses[lead.stage])}
                >
                  {pipelineStageLabels[lead.stage]}
                </span>
              </span>
              <span className="w-[15%] truncate text-[6.5px] text-muted-foreground">{lead.createdLabel}</span>
              <span className="flex w-[14%] shrink-0 justify-end gap-1">
                <span className="rounded border px-1 py-0.5 text-[6px] text-muted-foreground">Uredi</span>
                <span className="rounded border px-1 py-0.5 text-[6px] text-destructive">Izbriši</span>
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Ana Kovač detail — mirrors app/(dashboard)/leads/[id]/page.tsx */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-2 overflow-hidden px-4 py-3"
        animate={{ opacity: showDetail ? 1 : 0 }}
        transition={fadeTransition}
      >
        <div>
          <p className="text-[12px] font-semibold">Ana Kovač</p>
          <p className="text-[8px] text-muted-foreground">Prijava · Prijava prejeta</p>
        </div>
        <div className="rounded-lg border bg-background p-2">
          <p className="text-[7px] font-semibold text-muted-foreground uppercase">Kontaktni podatki</p>
          <p className="mt-1 text-[8.5px]">E-pošta: ana.kovac@example.com</p>
        </div>
        <div className="rounded-lg border bg-background p-2">
          <p className="text-[7px] font-semibold text-muted-foreground uppercase">Odgovori</p>
          <div className="mt-1 flex flex-col gap-1">
            {ANA_ANSWERS.map((answer, i) => (
              <motion.div
                key={answer.label}
                initial={{ opacity: 0, x: -4 }}
                animate={showDetail ? { opacity: 1, x: 0 } : { opacity: 0, x: -4 }}
                transition={withReducedMotion(reduceMotion, { duration: 0.4, delay: reduceMotion ? 0 : 0.1 + i * 0.1 })}
              >
                <p className="text-[8px] font-medium">{answer.label}</p>
                <p className="text-[7.5px] text-muted-foreground">{answer.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AppFrame>
  );
}

interface KanbanCard {
  name: string;
  email: string;
  source: LeadSource;
}

const ANA_LEAD: KanbanCard = { name: "Ana Kovač", email: "ana.kovac@example.com", source: "application" };

/** Mirrors hero-demo.tsx's KANBAN_FILLERS verbatim — real names/emails/sources
 *  from scripts/seed-demo.ts (minus Ana, who's the animated card here too, and
 *  minus the "lost" bucket, which isn't a kanban column) so the board matches
 *  the actual demo account exactly, same as the hero. */
const KANBAN_FILLERS: Partial<Record<PipelineStage, KanbanCard[]>> = {
  email_lead: [
    { name: "Sara Golob", email: "sara.golob@example.com", source: "lead_magnet" },
    { name: "Tim Kos", email: "tim.kos@example.com", source: "lead_magnet" },
  ],
  application_received: [{ name: "Maja Turk", email: "maja.turk@example.com", source: "application" }],
  contacted: [
    { name: "Nina Horvat", email: "nina.horvat@example.com", source: "application" },
    { name: "Marko Zupančič", email: "marko.zupancic@example.com", source: "application" },
    { name: "Eva Zupan", email: "eva.zupan@example.com", source: "application" },
    { name: "Luka Kranjc", email: "luka.kranjc@example.com", source: "application" },
  ],
  client: [
    { name: "Petra Vidmar", email: "petra.vidmar@example.com", source: "application" },
    { name: "Jan Božič", email: "jan.bozic@example.com", source: "lead_magnet" },
  ],
};

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
  const anaColumn = KANBAN_COLUMN_FOR_STAGE[stage];
  const showSuccess = stage === "col-3" || stage === "hold";

  return (
    <AppFrame className="h-110">
      <div className="flex h-full flex-col gap-1.5 px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">Kanban pregled</p>
        <div className="grid grow grid-cols-4 gap-1.5">
          {ACTIVE_PIPELINE_STAGES.map((col) => {
            const fillers = KANBAN_FILLERS[col] ?? [];
            const anaHere = anaColumn === col;
            return (
              <div key={col} className="flex flex-col gap-1 rounded-md bg-muted/40 p-1.5">
                <div className="flex items-center gap-1">
                  <span className={cn("size-1.5 shrink-0 rounded-full", pipelineStageDotClasses[col])} />
                  <span className="truncate text-[7px] font-medium text-muted-foreground">
                    {pipelineStageLabels[col]}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-card px-1 text-[6px] text-muted-foreground ring-1 ring-foreground/10">
                    {fillers.length + (anaHere ? 1 : 0)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {fillers.map((card) => (
                    <div key={card.email} className="rounded-md border bg-background px-1.5 py-1">
                      <KanbanCardBody card={card} />
                    </div>
                  ))}
                  <AnimatePresence>
                    {anaHere && (
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
                        <KanbanCardBody card={ANA_LEAD} success={showSuccess} />
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
          <span className="truncate text-[7.5px] font-medium">{card.name}</span>
        </div>
        <GripVertical className="size-2.5 shrink-0 text-muted-foreground/40" />
      </div>
      <p className="mt-0.5 truncate pl-5 text-[6.5px] text-muted-foreground">{card.email}</p>
      <div className="mt-0.5 pl-5">
        <span className={cn("rounded px-1 text-[6px] leading-[1.4]", leadSourceBadgeClasses[card.source])}>
          {leadSourceLabels[card.source]}
        </span>
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

type AnalyticsStage = "grow" | "hold";
const ANALYTICS_STAGES: readonly AnalyticsStage[] = ["grow", "hold"];
const ANALYTICS_DURATIONS: Record<AnalyticsStage, number> = { grow: 1200, hold: 1400 };

interface AnalyticsFunnelStage {
  stage: PipelineStage;
  count: number;
}

interface AnalyticsFunnel {
  title: string;
  dotClassName: string;
  stages: readonly AnalyticsFunnelStage[];
}

/** Mirrors the real /analytics page's two-funnel comparison
 *  (components/analytics/funnel.tsx), same stage labels/colors and the same
 *  demo counts a trainer would actually see on the seeded demo account, so
 *  this frame is a truthful miniature rather than invented chart data. */
const ANALYTICS_FUNNELS: readonly AnalyticsFunnel[] = [
  {
    title: sl.analytics.funnelApplication,
    dotClassName: "bg-hot",
    stages: [
      { stage: "application_received", count: 7 },
      { stage: "contacted", count: 5 },
      { stage: "client", count: 1 },
    ],
  },
  {
    title: sl.analytics.funnelLeadMagnet,
    dotClassName: "bg-primary",
    stages: [
      { stage: "email_lead", count: 3 },
      { stage: "application_received", count: 1 },
      { stage: "contacted", count: 1 },
      { stage: "client", count: 1 },
    ],
  },
];

export function AnalyticsFrame({ isActive }: { isActive: boolean }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { cycle } = useStageLoop(ANALYTICS_STAGES, ANALYTICS_DURATIONS, isActive);

  return (
    <AppFrame>
      <div className="flex h-full flex-col gap-2 px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">{sl.analytics.funnelTitle}</p>
        <div key={cycle} className="mt-1 grid grid-cols-2 gap-4">
          {ANALYTICS_FUNNELS.map((funnel) => (
            <AnalyticsFunnelColumn key={funnel.title} funnel={funnel} reduceMotion={reduceMotion} />
          ))}
        </div>
      </div>
    </AppFrame>
  );
}

function AnalyticsFunnelColumn({ funnel, reduceMotion }: { funnel: AnalyticsFunnel; reduceMotion: boolean }) {
  const max = Math.max(1, ...funnel.stages.map((s) => s.count));

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-0.5 flex items-center gap-1">
        <span className={cn("size-1.5 shrink-0 rounded-full", funnel.dotClassName)} />
        <span className="truncate text-[6.5px] font-semibold">{funnel.title}</span>
      </div>
      {funnel.stages.map((s, i) => {
        const prev = i > 0 ? funnel.stages[i - 1].count : null;
        const dropoff = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        const delay = i * 0.15;
        return (
          <div key={s.stage}>
            {i > 0 && dropoff !== null && (
              <motion.p
                className="pl-11 text-[6px] text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={withReducedMotion(reduceMotion, { duration: 0.3, delay })}
              >
                ↓ {dropoff}%
              </motion.p>
            )}
            <div className="flex items-center gap-1">
              <span className="w-10 shrink-0 truncate text-right text-[6px] text-muted-foreground">
                {pipelineStageLabels[s.stage]}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-xs bg-muted/40">
                <motion.div
                  className={cn(
                    "flex h-full items-center rounded-xs px-1 text-[5.5px] font-semibold text-white",
                    pipelineStageDotClasses[s.stage],
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(16, (s.count / max) * 100)}%` }}
                  transition={withReducedMotion(reduceMotion, { duration: 0.7, delay, ease: EASE })}
                >
                  {s.count}
                </motion.div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

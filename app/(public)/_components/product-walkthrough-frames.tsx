"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LeadSource, PipelineStage } from "@/db/schema";
import { leadSourceBadgeClasses, pipelineStageDotClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";

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

/** Advances through `stages` on a timer while `isActive`; resets to the
 *  first stage and freezes there while inactive, so a step re-entering the
 *  viewport always restarts its animation from the same visual beat.
 *  `cycle` counts full passes through `stages`, for callers that need to
 *  force-replay a mount-only entrance animation via a React `key`. */
function useStageLoop<T extends string>(
  stages: readonly T[],
  durations: Record<T, number>,
  isActive: boolean,
): { stage: T; cycle: number } {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setTick(0);
      return;
    }
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

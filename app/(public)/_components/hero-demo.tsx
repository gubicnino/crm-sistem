"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { CheckCircle2, ChevronDown, Mail } from "lucide-react";
import { pipelineStageDotClasses } from "@/lib/badge-styles";
import { pipelineStageLabels } from "@/lib/labels";
import { ACTIVE_PIPELINE_STAGES } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

type FieldType = "text" | "select" | "textarea" | "checkbox";

interface DemoField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  answer?: string;
}

/** Mirrors scripts/seed-demo.ts's applicationQuestions verbatim, and the
 *  answers below match its seeded "Ana Kovač" lead exactly — this demo is a
 *  live recreation of the real demo account, not invented copy. */
const FORM_FIELDS: DemoField[] = [
  { id: "goal", label: "Kakšen je tvoj cilj?", type: "text", answer: "Shujšati 5 kg" },
  {
    id: "experience",
    label: "Koliko časa že treniraš?",
    type: "select",
    options: ["Manj kot leto", "1-3 leta", "Več kot 3 leta"],
    answer: "Manj kot leto",
  },
  { id: "availability", label: "Kdaj si na voljo za treninge?", type: "text" },
  { id: "injuries", label: "Imaš kakšne poškodbe ali zdravstvene omejitve?", type: "textarea" },
  { id: "location", label: "Kje bi rad treniral?", type: "select", options: ["V fitnesu", "Na prostem", "Doma"] },
  { id: "newsletter", label: "Se želiš prijaviti na e-novice z nasveti za trening?", type: "checkbox" },
];

const ANSWERED_FIELDS = FORM_FIELDS.filter((f) => f.answer);

const LEAD_NAME = "Ana Kovač";
const LEAD_EMAIL = "ana.kovac@example.com";
const LEAD_INITIALS = "AK";

const STAGES = [
  "form-empty",
  "form-filling",
  "form-submit",
  "flying",
  "crm-detail",
  "detail-hold",
  "email-send",
  "kanban-enter",
  "hop-contacted",
  "hop-client",
  "hold-end",
] as const;
type Stage = (typeof STAGES)[number];

const DURATIONS: Record<Stage, number> = {
  "form-empty": 500,
  "form-filling": 1400,
  "form-submit": 500,
  flying: 700,
  "crm-detail": 900,
  "detail-hold": 700,
  "email-send": 700,
  "kanban-enter": 700,
  "hop-contacted": 800,
  "hop-client": 800,
  "hold-end": 1100,
};

const POS = {
  button: { left: "78%", top: "94%" },
  crmHeader: { left: "50%", top: "12%" },
  kanban: ["12%", "38%", "63%", "88%"],
} as const;

function chipPosition(stage: Stage) {
  switch (stage) {
    case "kanban-enter":
      return { left: POS.kanban[1], top: "40%" };
    case "hop-contacted":
      return { left: POS.kanban[2], top: "40%" };
    case "hop-client":
    case "hold-end":
      return { left: POS.kanban[3], top: "40%" };
    case "form-submit":
      return POS.button;
    default:
      return POS.crmHeader;
  }
}

function chipStage(stage: Stage): "application_received" | "contacted" | "client" | null {
  if (stage === "crm-detail" || stage === "detail-hold" || stage === "email-send" || stage === "kanban-enter") {
    return "application_received";
  }
  if (stage === "hop-contacted") return "contacted";
  if (stage === "hop-client" || stage === "hold-end") return "client";
  return null;
}

function screenOpacity(stage: Stage) {
  const idx = STAGES.indexOf(stage);
  const formIdx = STAGES.indexOf("form-submit");
  const crmDetailIdx = STAGES.indexOf("crm-detail");
  const kanbanIdx = STAGES.indexOf("kanban-enter");
  return {
    form: idx <= formIdx ? 1 : 0,
    crm: idx >= crmDetailIdx && idx < kanbanIdx ? 1 : 0,
    kanban: idx >= kanbanIdx ? 1 : 0,
  };
}

export function HeroDemo() {
  const [stageIndex, setStageIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const stage = STAGES[stageIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, DURATIONS[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  const opacity = screenOpacity(stage);
  const filled = stageIndex >= STAGES.indexOf("form-filling");
  const chipVisible =
    stage === "form-submit" ||
    stage === "flying" ||
    stage === "kanban-enter" ||
    stage === "hop-contacted" ||
    stage === "hop-client" ||
    stage === "hold-end";
  const pos = chipPosition(stage);
  const activeChipStage = chipStage(stage);
  const showDetail = stage === "crm-detail" || stage === "detail-hold" || stage === "email-send";
  const showSuccess = stage === "hop-client" || stage === "hold-end";

  const spatialTransition: Transition = reduceMotion
    ? { duration: 0.15 }
    : { duration: DURATIONS[stage] / 1000, ease: EASE };
  const fadeTransition: Transition = { duration: 0.45, ease: EASE };

  return (
    <div
      aria-hidden="true"
      className="relative h-[440px] w-full overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-background/15 shadow-2xl shadow-black/40"
    >
      <p className="sr-only">
        Animirana ponazoritev: obiskovalec izpolni prijavno formo, povpraševanje se samodejno zabeleži v CRM s
        podrobnostmi odgovorov, sproži se avtomatski email, stranka pa se premika po kanban pregledu do stopnje
        &quot;Stranka&quot;.
      </p>

      <div className="absolute inset-x-0 top-0 z-20 flex h-6 items-center gap-1.5 border-b bg-muted/40 px-3">
        <span className="size-2 rounded-full bg-destructive/40" />
        <span className="size-2 rounded-full bg-hot/40" />
        <span className="size-2 rounded-full bg-success/40" />
      </div>

      {/* Form screen */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-2 overflow-hidden px-5 py-3"
        animate={{ opacity: opacity.form }}
        transition={fadeTransition}
      >
        <div>
          <p className="text-[13px] font-semibold">Prijavi se</p>
          <p className="text-[9px] text-muted-foreground">Izpolni formo in se ti oglasim v 24 urah</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {FORM_FIELDS.map((field, i) => (
            <FormFieldRow key={field.id} field={field} filled={filled} delay={i * 0.35} />
          ))}
        </div>
        <motion.div
          className="mt-1 w-fit rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground"
          animate={stage === "form-submit" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          Pošlji prijavo
        </motion.div>
      </motion.div>

      {/* CRM detail screen */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-2 px-5 py-3"
        animate={{ opacity: opacity.crm }}
        transition={fadeTransition}
      >
        <div className="mt-9 flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold">{LEAD_NAME}</p>
            <p className="text-[9px] text-muted-foreground">Prijava · Prijava prejeta</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            <span className="rounded border px-1.5 py-0.5 text-[8px] text-muted-foreground">Prijava prejeta ⌄</span>
            <span className="rounded border px-1.5 py-0.5 text-[8px] text-muted-foreground">Uredi</span>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-2">
          <p className="text-[8px] font-semibold text-muted-foreground uppercase">Kontaktni podatki</p>
          <p className="mt-1 text-[10px]">E-pošta: {LEAD_EMAIL}</p>
        </div>

        <div className="rounded-lg border bg-background p-2">
          <p className="text-[8px] font-semibold text-muted-foreground uppercase">Odgovori</p>
          <div className="mt-1 flex flex-col gap-1.5">
            {ANSWERED_FIELDS.map((field) => (
              <AnimatePresence key={field.id}>
                {showDetail && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.1 }}
                  >
                    <p className="text-[10px] font-medium">{field.label}</p>
                    <p className="text-[9px] text-muted-foreground">{field.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {stage === "email-send" && (
            <motion.div
              className="absolute top-8 right-4 text-primary"
              initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], scale: 1, x: 46, y: -30 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
            >
              <Mail className="size-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Kanban screen */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-2 px-5 py-3"
        animate={{ opacity: opacity.kanban }}
        transition={fadeTransition}
      >
        <p className="text-[11px] font-medium text-muted-foreground">Kanban pregled</p>
        <div className="mt-1 grid grow grid-cols-4 gap-2">
          {ACTIVE_PIPELINE_STAGES.map((s) => (
            <div key={s} className="flex flex-col gap-1 rounded-md bg-muted/40 p-1.5">
              <div className="flex items-center gap-1">
                <span className={cn("size-1.5 shrink-0 rounded-full", pipelineStageDotClasses[s])} />
                <span className="truncate text-[8px] font-medium text-muted-foreground">
                  {pipelineStageLabels[s]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Traveling lead chip — shared across form -> CRM -> kanban */}
      <motion.div
        className="absolute z-10 flex w-28 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 shadow-md"
        animate={{
          left: pos.left,
          top: pos.top,
          opacity: chipVisible ? 1 : 0,
          scale: showSuccess ? 1.05 : 1,
        }}
        transition={{ ...spatialTransition, opacity: fadeTransition }}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-medium text-primary">
          {LEAD_INITIALS}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium">{LEAD_NAME}</p>
          {activeChipStage && (
            <p className="flex items-center gap-1 text-[8px] text-muted-foreground">
              <span className={cn("size-1 shrink-0 rounded-full", pipelineStageDotClasses[activeChipStage])} />
              {pipelineStageLabels[activeChipStage]}
            </p>
          )}
        </div>
        <AnimatePresence>
          {showSuccess && (
            <motion.span
              className="absolute -top-1.5 -right-1.5 text-success"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CheckCircle2 className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function FormFieldRow({ field, filled, delay }: { field: DemoField; filled: boolean; delay: number }) {
  const transition = { duration: 0.35, delay, ease: EASE };
  const showValue = filled && field.answer;

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-sm border" />
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

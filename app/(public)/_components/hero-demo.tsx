"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { CheckCircle2, ChevronDown, GripVertical, Mail } from "lucide-react";
import { leadSourceBadgeClasses, pipelineStageDotClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
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

/** Mirrors scripts/seed-demo.ts's applicationQuestions verbatim. The goal
 *  and experience answers match its seeded "Ana Kovač" lead exactly; her
 *  real seed data only answers those two (the rest are optional and she
 *  skipped them there), so the remaining four are plausible invented
 *  answers — filled in so the demo shows every question getting answered. */
const FORM_FIELDS: DemoField[] = [
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

const ANSWERED_FIELDS = FORM_FIELDS.filter((f) => f.answer);

const LEAD_NAME = "Ana Kovač";
const LEAD_EMAIL = "ana.kovac@example.com";
const LEAD_INITIALS = "AK";

interface KanbanLead {
  name: string;
  email: string;
  source: "application" | "lead_magnet";
}

const ANA_LEAD: KanbanLead = { name: LEAD_NAME, email: LEAD_EMAIL, source: "application" };

/** The rest of scripts/seed-demo.ts's seeded leads (minus Ana, who's the
 *  animated one, and minus the "lost" bucket, which isn't a kanban column) —
 *  real names/emails/sources so the board matches the actual demo account. */
const KANBAN_FILLERS: Record<string, KanbanLead[]> = {
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

const STAGES = [
  "form-empty",
  "form-filling",
  "form-submit",
  "flying",
  "email-send",
  "crm-detail",
  "detail-hold",
  "kanban-enter",
  "hop-contacted",
  "hop-client",
  "hold-end",
] as const;
type Stage = (typeof STAGES)[number];

/** Deliberately unhurried — this loops in a hero section, not a demo the
 *  visitor is impatiently clicking through. */
const DURATIONS: Record<Stage, number> = {
  "form-empty": 700,
  "form-filling": 1900,
  "form-submit": 700,
  flying: 900,
  "email-send": 900,
  "crm-detail": 1300,
  "detail-hold": 1100,
  "kanban-enter": 900,
  "hop-contacted": 1000,
  "hop-client": 1000,
  "hold-end": 1600,
};

const POS = {
  button: { left: "78%", top: "94%" },
  crmHeader: { left: "50%", top: "12%" },
} as const;

/** Which kanban column (if any) Ana's card currently belongs to. */
function anaColumnStage(stage: Stage): "application_received" | "contacted" | "client" | null {
  if (stage === "kanban-enter") return "application_received";
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
  const chipVisible = stage === "form-submit" || stage === "flying" || stage === "email-send";
  const anaStage = anaColumnStage(stage);
  const showSuccess = stage === "hop-client" || stage === "hold-end";

  const spatialTransition: Transition = reduceMotion
    ? { duration: 0.2 }
    : { duration: DURATIONS[stage] / 1000, ease: EASE };
  const fadeTransition: Transition = { duration: 0.75, ease: EASE };
  const layoutTransition: Transition = reduceMotion ? { duration: 0.2 } : { duration: 0.8, ease: EASE };

  return (
    <div
      aria-hidden="true"
      className="relative h-[480px] w-full overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-background/15 shadow-2xl shadow-black/40"
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
            <FormFieldRow key={field.id} field={field} filled={filled} delay={i * 0.5} />
          ))}
        </div>
        <motion.div
          className="mt-1 w-fit rounded-md bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground"
          animate={stage === "form-submit" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          Pošlji prijavo
        </motion.div>
      </motion.div>

      {/* Email-send beat — between submit and the CRM detail appearing */}
      <AnimatePresence>
        {stage === "email-send" && (
          <motion.div
            className="absolute z-20 text-primary"
            style={{ left: POS.crmHeader.left, top: POS.crmHeader.top }}
            initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: 1, x: 60, y: -34 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <Mail className="size-4" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CRM detail screen */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-2 px-5 py-3"
        animate={{ opacity: opacity.crm }}
        transition={fadeTransition}
      >
        <div className="flex items-start justify-between gap-2">
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
            {ANSWERED_FIELDS.map((field, i) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, x: -6 }}
                animate={opacity.crm ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
                transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.15 + i * 0.15 }}
              >
                <p className="text-[10px] font-medium">{field.label}</p>
                <p className="text-[9px] text-muted-foreground">{field.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Kanban screen */}
      <motion.div
        className="absolute inset-0 top-6 flex flex-col gap-1.5 px-4 py-3"
        animate={{ opacity: opacity.kanban }}
        transition={fadeTransition}
      >
        <p className="text-[11px] font-medium text-muted-foreground">Kanban pregled</p>
        <div className="grid grow grid-cols-4 gap-1.5">
          {ACTIVE_PIPELINE_STAGES.map((s) => {
            const fillers = KANBAN_FILLERS[s] ?? [];
            const anaHere = anaStage === s;
            return (
              <div key={s} className="flex flex-col gap-1 rounded-md bg-muted/40 p-1.5">
                <div className="flex items-center gap-1">
                  <span className={cn("size-1.5 shrink-0 rounded-full", pipelineStageDotClasses[s])} />
                  <span className="truncate text-[8px] font-medium text-muted-foreground">
                    {pipelineStageLabels[s]}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-card px-1 text-[7px] text-muted-foreground ring-1 ring-foreground/10">
                    {fillers.length + (anaHere ? 1 : 0)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {fillers.map((lead) => (
                    <div key={lead.email} className="rounded-md border bg-background px-1.5 py-1">
                      <KanbanLeadCardBody lead={lead} />
                    </div>
                  ))}
                  <AnimatePresence>
                    {anaHere && (
                      <motion.div
                        layoutId="hero-demo-ana-card"
                        className="relative rounded-md border bg-background px-1.5 py-1 ring-1 ring-primary/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ layout: layoutTransition, opacity: fadeTransition }}
                      >
                        <KanbanLeadCardBody lead={ANA_LEAD} success={showSuccess} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Traveling lead chip — form submit through the email-send beat */}
      <motion.div
        className="absolute z-10 flex w-28 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 shadow-md"
        animate={{
          left: stage === "form-submit" ? POS.button.left : POS.crmHeader.left,
          top: stage === "form-submit" ? POS.button.top : POS.crmHeader.top,
          opacity: chipVisible ? 1 : 0,
        }}
        transition={{ ...spatialTransition, opacity: fadeTransition }}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-medium text-primary">
          {LEAD_INITIALS}
        </span>
        <p className="truncate text-[10px] font-medium">{LEAD_NAME}</p>
      </motion.div>
    </div>
  );
}

function KanbanLeadCardBody({ lead, success }: { lead: KanbanLead; success?: boolean }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full text-[7px] font-medium",
              avatarTintClass(lead.email),
            )}
          >
            {initials(lead.name, lead.email)}
          </span>
          <span className="truncate text-[8px] font-medium">{lead.name}</span>
        </div>
        <GripVertical className="size-2.5 shrink-0 text-muted-foreground/40" />
      </div>
      <p className="mt-0.5 truncate pl-5 text-[7px] text-muted-foreground">{lead.email}</p>
      <div className="mt-0.5 pl-5">
        <span className={cn("rounded px-1 text-[6.5px] leading-[1.4]", leadSourceBadgeClasses[lead.source])}>
          {leadSourceLabels[lead.source]}
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

function FormFieldRow({ field, filled, delay }: { field: DemoField; filled: boolean; delay: number }) {
  const transition = { duration: 0.5, delay, ease: EASE };
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

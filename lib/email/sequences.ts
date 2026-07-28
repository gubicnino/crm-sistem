import type { LeadSource } from "@/db/schema";
import { MAX_SCHEDULE_DAYS } from "@/lib/email/constants";

export type TemplateKey =
  | "application_confirmation"
  | "application_booking_prompt"
  | "application_followup_2"
  | "application_followup_5"
  | "lead_magnet_guide"
  | "lead_magnet_edu_2"
  | "lead_magnet_edu_5"
  | "lead_magnet_edu_9"
  | "lead_magnet_edu_14";

export interface SequenceContext {
  leadName: string | null;
  trainerName: string;
}

export interface SequenceStep {
  /** Stable, never reused — half of the (leadId, sequenceStep) unique key in scheduled_emails. */
  id: string;
  /** Days after lead creation. Must be 0-30 (Resend's scheduling ceiling). */
  dayOffset: number;
  template: TemplateKey;
  subject: (ctx: SequenceContext) => string;
}

/**
 * Two distinct sequences per CLAUDE.md's product model: a fast sequence for
 * `application` leads (instant confirmation + booking prompt), a nurture
 * sequence for `lead_magnet` leads (guide, then education over days).
 * TODO: copy review — subjects are placeholders; see lib/email/copy.ts for bodies.
 */
export const SEQUENCES: Record<LeadSource, SequenceStep[]> = {
  application: [
    {
      id: "application_day0_confirmation",
      dayOffset: 0,
      template: "application_confirmation",
      subject: () => "Prejeli smo vašo prijavo",
    },
    {
      id: "application_day0_booking",
      dayOffset: 0,
      template: "application_booking_prompt",
      subject: () => "Rezervirajte termin za klic",
    },
    {
      id: "application_day2_followup",
      dayOffset: 2,
      template: "application_followup_2",
      subject: () => "Še vedno vas zanima?",
    },
    {
      id: "application_day5_followup",
      dayOffset: 5,
      template: "application_followup_5",
      subject: () => "Zadnja priložnost za termin",
    },
  ],
  lead_magnet: [
    {
      id: "lead_magnet_day0_guide",
      dayOffset: 0,
      template: "lead_magnet_guide",
      subject: () => "Vaš brezplačni vodič",
    },
    {
      id: "lead_magnet_day2_edu",
      dayOffset: 2,
      template: "lead_magnet_edu_2",
      subject: () => "Kako začeti",
    },
    {
      id: "lead_magnet_day5_edu",
      dayOffset: 5,
      template: "lead_magnet_edu_5",
      subject: () => "Pogosta napaka pri treniranju",
    },
    {
      id: "lead_magnet_day9_edu",
      dayOffset: 9,
      template: "lead_magnet_edu_9",
      subject: () => "Doslednost je pomembnejša od popolnosti",
    },
    {
      id: "lead_magnet_day14_edu",
      dayOffset: 14,
      template: "lead_magnet_edu_14",
      subject: () => "Pripravljeni na naslednji korak?",
    },
  ],
};

export function sequenceFor(source: LeadSource): SequenceStep[] {
  return SEQUENCES[source];
}

// Module-load assertions — a bad edit fails `next build`, not production.
for (const [source, steps] of Object.entries(SEQUENCES)) {
  const seenIds = new Set<string>();
  for (const step of steps) {
    if (step.dayOffset < 0 || step.dayOffset > MAX_SCHEDULE_DAYS) {
      throw new Error(
        `Sequence step "${step.id}" (${source}) has dayOffset ${step.dayOffset}, outside 0-${MAX_SCHEDULE_DAYS}`,
      );
    }
    if (seenIds.has(step.id)) {
      throw new Error(`Duplicate sequence step id "${step.id}" in ${source}`);
    }
    seenIds.add(step.id);
  }
}

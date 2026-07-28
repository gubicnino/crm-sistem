import type { LeadSource, PipelineStage } from "@/db/schema";
import type { ScheduledEmailStatus } from "@/db/types";

/**
 * Exhaustive Record<enum, string> — adding a new pipeline_stage or lead_source
 * value without updating the matching map here is a compile error, not a
 * silent UI gap. Keeps Slovenian display labels in the UI layer, never the DB,
 * per CLAUDE.md's "Pipeline stages" section.
 */
export const pipelineStageLabels: Record<PipelineStage, string> = {
  email_lead: "E-poštni kontakt",
  application_received: "Prijava prejeta",
  contacted: "Kontaktiran",
  client: "Stranka",
  lost: "Izgubljen",
};

export const leadSourceLabels: Record<LeadSource, string> = {
  application: "Prijava",
  lead_magnet: "Brezplačni vodič",
};

export const scheduledEmailStatusLabels: Record<ScheduledEmailStatus, string> = {
  pending: "V pripravi",
  scheduled: "Načrtovano",
  sent: "Poslano",
  canceled: "Preklicano",
  orphaned: "Osirotelo",
  cancel_failed: "Napaka pri preklicu",
};

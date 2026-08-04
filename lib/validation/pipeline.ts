import { z } from "zod";

const stageLabel = z.string().trim().min(1, { error: "Ime faze je obvezno." }).max(30, { error: "Ime faze je lahko dolgo največ 30 znakov." });

/** Exhaustive over PipelineStage's 5 values (db/schema.ts) — a missing or
 *  extra key is a validation error here, not a silently-dropped write,
 *  matching lib/labels.ts's exhaustive pipelineStageLabels map. */
export const stageLabelsSchema = z.object({
  email_lead: stageLabel,
  application_received: stageLabel,
  contacted: stageLabel,
  client: stageLabel,
  lost: stageLabel,
});

export type StageLabelsInput = z.infer<typeof stageLabelsSchema>;

import { pipelineStageEnum, type PipelineStage } from "@/db/schema";

/** Kanban column order (Phase 5) — 'lost' is a terminal bucket shown last. */
export const PIPELINE_STAGES = pipelineStageEnum.enumValues;

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

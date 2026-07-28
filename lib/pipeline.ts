import { pipelineStageEnum, type PipelineStage } from "@/db/schema";

/** Kanban column order (Phase 5) — 'lost' is a terminal bucket shown last. */
export const PIPELINE_STAGES = pipelineStageEnum.enumValues;

/**
 * Single source of truth for "this stage is a dead end" — a lead here never
 * receives further sequence emails and is excluded from stuck-lead detection.
 * Previously hardcoded independently as `stage === "client" || stage ===
 * "lost"` in five places (lib/cron/stuck-leads.ts, lib/cron/reconcile.ts,
 * db/queries/analytics.ts, db/queries/leads.ts x2) — consolidated here so a
 * future stage change only touches one place.
 */
export const TERMINAL_STAGES: readonly PipelineStage[] = ["client", "lost"];

export function isTerminalStage(stage: PipelineStage): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage);
}

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

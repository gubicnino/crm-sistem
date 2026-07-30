import { pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";

/** Kanban column order (Phase 5) — 'lost' is a terminal bucket shown last. */
export const PIPELINE_STAGES = pipelineStageEnum.enumValues;

/** The 4 stages rendered as kanban columns — 'lost' gets its own separate
 *  drop panel (components/pipeline/lost-panel.tsx) per CLAUDE.md's "Kanban
 *  pipeline" tab description, not a 5th column. Derived, not a second
 *  hardcoded list, so adding a stage can't desync the two. */
export const ACTIVE_PIPELINE_STAGES: readonly PipelineStage[] = PIPELINE_STAGES.filter((stage) => stage !== "lost");

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
};

export function isStuck(stage: PipelineStage, daysInStage: number): boolean {
  const threshold = STUCK_THRESHOLD_DAYS[stage];
  return threshold !== undefined && daysInStage >= threshold;
}

/** Where each lead source enters the pipeline — drives both the funnel's
 *  stage count per source (Analitika) and CLAUDE.md's "two lead sources"
 *  table. `application` skips `email_lead` since it arrives as a full
 *  application, not a cold capture. */
export const ENTRY_STAGE: Record<LeadSource, PipelineStage> = {
  application: "application_received",
  lead_magnet: "email_lead",
};

/** 0-based position in the ordinal (non-terminal) progression, or -1 for
 *  `lost` — a lost lead's prior progress isn't recorded anywhere (no stage-
 *  history table), so it's excluded from cumulative funnel math rather than
 *  guessed at. */
export function pipelineStageRank(stage: PipelineStage): number {
  return ACTIVE_PIPELINE_STAGES.indexOf(stage);
}

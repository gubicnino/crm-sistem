import { db } from "@/db";
import { leadSourceEnum, leads, pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";
import { isStuck } from "@/lib/pipeline";
import { ownedBy, type TrainerScope } from "@/lib/tenant";

export interface AnalyticsSummary {
  totalLeads: number;
  byStage: Record<PipelineStage, number>;
  bySource: Record<LeadSource, number>;
  newThisWeek: number;
  /** 0..1 — share of all leads that reached `client`. */
  conversionRate: number;
  /** Median days-in-current-stage across non-terminal leads; null if there are none. */
  medianDaysInStage: number | null;
  stuckCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function median(sortedValues: number[]): number {
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

/**
 * Computed in JS over a single scoped select rather than SQL aggregates —
 * per-trainer lead volumes here are small, and this avoids depending on
 * neon-http's raw db.execute() row shape for a percentile_cont query.
 */
export async function getAnalyticsSummary(scope: TrainerScope): Promise<AnalyticsSummary> {
  const rows = await db
    .select({
      stage: leads.stage,
      source: leads.source,
      createdAt: leads.createdAt,
      stageChangedAt: leads.stageChangedAt,
    })
    .from(leads)
    .where(ownedBy(leads, scope));

  const byStage = Object.fromEntries(pipelineStageEnum.enumValues.map((s) => [s, 0])) as Record<
    PipelineStage,
    number
  >;
  const bySource = Object.fromEntries(leadSourceEnum.enumValues.map((s) => [s, 0])) as Record<LeadSource, number>;

  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  let newThisWeek = 0;
  let clientCount = 0;
  let stuckCount = 0;
  const daysInStage: number[] = [];

  for (const lead of rows) {
    byStage[lead.stage]++;
    bySource[lead.source]++;
    if (lead.createdAt.getTime() >= weekAgo) newThisWeek++;
    if (lead.stage === "client") clientCount++;

    if (lead.stage !== "client" && lead.stage !== "lost") {
      const days = (now - lead.stageChangedAt.getTime()) / DAY_MS;
      daysInStage.push(days);
      if (isStuck(lead.stage, days)) stuckCount++;
    }
  }

  daysInStage.sort((a, b) => a - b);

  return {
    totalLeads: rows.length,
    byStage,
    bySource,
    newThisWeek,
    conversionRate: rows.length > 0 ? clientCount / rows.length : 0,
    medianDaysInStage: daysInStage.length > 0 ? median(daysInStage) : null,
    stuckCount,
  };
}

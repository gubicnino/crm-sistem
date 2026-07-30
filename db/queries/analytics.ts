import { db } from "@/db";
import { leadSourceEnum, leads, pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";
import { ACTIVE_PIPELINE_STAGES, ENTRY_STAGE, isStuck, isTerminalStage, pipelineStageRank } from "@/lib/pipeline";
import { ownedBy, type TrainerScope } from "@/lib/tenant";

export interface AnalyticsSummary {
  totalLeads: number;
  byStage: Record<PipelineStage, number>;
  bySource: Record<LeadSource, number>;
  newThisWeek: number;
  newPrevWeek: number;
  /** 0..1 — share of all leads that reached `client`. */
  conversionRate: number;
  conversionRatePrevWeek: number;
  /** Median days-in-current-stage across non-terminal leads; null if there are none. */
  medianDaysInStage: number | null;
  stuckCount: number;
  /** Per-source cumulative "reached this stage or beyond" counts, ordered
   *  from each source's ENTRY_STAGE through `client`. Cumulative among
   *  currently active-or-converted leads only — a `lost` lead's prior
   *  progress isn't recorded anywhere (no stage-history table), so lost
   *  leads are excluded rather than guessed at. See lib/pipeline.ts's
   *  pipelineStageRank doc. */
  funnels: Record<LeadSource, { stage: PipelineStage; count: number }[]>;
  /** Daily new-lead counts for the last 30 days, oldest first. */
  dailyNewLeads: { date: string; count: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function median(sortedValues: number[]): number {
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
    : sortedValues[mid];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Computed in JS over a single scoped select rather than SQL aggregates —
 * per-trainer lead volumes here are small, and this avoids depending on
 * neon-http's raw db.execute() row shape for a percentile_cont query.
 */
export async function getAnalyticsSummary(scope: TrainerScope): Promise<AnalyticsSummary> {
  const rows = await db
    .select({
      source: leads.source,
      stage: leads.stage,
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
  const funnelCounts = Object.fromEntries(
    leadSourceEnum.enumValues.map((s) => [s, ACTIVE_PIPELINE_STAGES.map(() => 0)]),
  ) as Record<LeadSource, number[]>;

  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;
  const thirtyDaysAgo = now - 30 * DAY_MS;

  let newThisWeek = 0;
  let newPrevWeek = 0;
  let clientCount = 0;
  let clientCountAsOfPrevWeek = 0;
  let leadCountAsOfPrevWeek = 0;
  let stuckCount = 0;
  const daysInStage: number[] = [];

  const dailyBuckets = new Map<string, number>();
  for (let t = thirtyDaysAgo; t <= now; t += DAY_MS) {
    dailyBuckets.set(dateKey(new Date(t)), 0);
  }

  for (const lead of rows) {
    byStage[lead.stage]++;
    bySource[lead.source]++;

    const createdAtMs = lead.createdAt.getTime();
    if (createdAtMs >= weekAgo) newThisWeek++;
    else if (createdAtMs >= twoWeeksAgo) newPrevWeek++;
    if (lead.stage === "client") clientCount++;

    // "As of a week ago" — approximated from current data since there's no
    // stage-history table: a lead created before then counts, and if it's
    // since converted we can't know whether it already had by that date, so
    // we conservatively use its current client-ness. This makes the delta a
    // directional signal, not an exact backdated recomputation.
    if (createdAtMs < weekAgo) {
      leadCountAsOfPrevWeek++;
      if (lead.stage === "client") clientCountAsOfPrevWeek++;
    }

    if (createdAtMs >= thirtyDaysAgo) {
      const key = dateKey(lead.createdAt);
      dailyBuckets.set(key, (dailyBuckets.get(key) ?? 0) + 1);
    }

    const rank = pipelineStageRank(lead.stage);
    if (rank >= 0) {
      const entryRank = pipelineStageRank(ENTRY_STAGE[lead.source]);
      for (let i = entryRank; i <= rank; i++) {
        funnelCounts[lead.source][i]++;
      }
    }

    if (!isTerminalStage(lead.stage)) {
      const days = (now - lead.stageChangedAt.getTime()) / DAY_MS;
      daysInStage.push(days);
      if (isStuck(lead.stage, days)) stuckCount++;
    }
  }

  daysInStage.sort((a, b) => a - b);

  const funnels = Object.fromEntries(
    leadSourceEnum.enumValues.map((source) => {
      const entryRank = pipelineStageRank(ENTRY_STAGE[source]);
      const stages = ACTIVE_PIPELINE_STAGES.slice(entryRank);
      return [source, stages.map((stage, i) => ({ stage, count: funnelCounts[source][entryRank + i] }))];
    }),
  ) as Record<LeadSource, { stage: PipelineStage; count: number }[]>;

  const dailyNewLeads = [...dailyBuckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));

  return {
    totalLeads: rows.length,
    byStage,
    bySource,
    newThisWeek,
    newPrevWeek,
    conversionRate: rows.length > 0 ? clientCount / rows.length : 0,
    conversionRatePrevWeek: leadCountAsOfPrevWeek > 0 ? clientCountAsOfPrevWeek / leadCountAsOfPrevWeek : 0,
    medianDaysInStage: daysInStage.length > 0 ? median(daysInStage) : null,
    stuckCount,
    funnels,
    dailyNewLeads,
  };
}

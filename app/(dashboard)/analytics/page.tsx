import { BarList } from "@/components/analytics/bar-list";
import { Funnel, FunnelSection } from "@/components/analytics/funnel";
import { NewLeadsChart } from "@/components/analytics/new-leads-chart";
import { StatCard, type StatDelta } from "@/components/analytics/stat-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAnalyticsSummary } from "@/db/queries/analytics";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

function countDelta(current: number, previous: number): StatDelta {
  if (current === previous) return { text: sl.analytics.deltaNoChange, direction: "flat" };
  const diff = current - previous;
  return diff > 0
    ? { text: sl.analytics.deltaMore(diff), direction: "up" }
    : { text: sl.analytics.deltaFewer(diff), direction: "down" };
}

function ppDelta(current: number, previous: number): StatDelta {
  const diffPp = (current - previous) * 100;
  if (Math.abs(diffPp) < 0.05) return { text: sl.analytics.deltaNoChange, direction: "flat" };
  return diffPp > 0
    ? { text: sl.analytics.deltaPpMore(diffPp.toFixed(1)), direction: "up" }
    : { text: sl.analytics.deltaPpFewer(diffPp.toFixed(1)), direction: "down" };
}

export default async function AnalyticsPage() {
  const scope = await requireTrainer();
  const summary = await getAnalyticsSummary(scope);

  if (summary.totalLeads === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={sl.analytics.title} />
        <p className="text-muted-foreground">{sl.analytics.noData}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.analytics.title} description={sl.analytics.subtitle} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label={sl.analytics.totalLeads} value={summary.totalLeads} />
        <StatCard
          label={sl.analytics.newThisWeek}
          value={summary.newThisWeek}
          delta={countDelta(summary.newThisWeek, summary.newPrevWeek)}
        />
        <StatCard
          label={sl.analytics.conversionRate}
          value={`${Math.round(summary.conversionRate * 100)}%`}
          delta={ppDelta(summary.conversionRate, summary.conversionRatePrevWeek)}
        />
        <StatCard label={sl.analytics.stuckCount} value={summary.stuckCount} />
        {summary.medianDaysInStage !== null && (
          <StatCard label={sl.analytics.medianDaysInStage} value={summary.medianDaysInStage.toFixed(1)} />
        )}
      </div>

      <FunnelSection title={sl.analytics.funnelTitle} subtitle={sl.analytics.funnelSubtitle}>
        <Funnel title={sl.analytics.funnelApplication} stages={summary.funnels.application} dotClassName="bg-hot" />
        <Funnel title={sl.analytics.funnelLeadMagnet} stages={summary.funnels.lead_magnet} dotClassName="bg-primary" />
      </FunnelSection>

      <NewLeadsChart data={summary.dailyNewLeads} />

      <div className="grid gap-6 sm:grid-cols-2">
        <BarList
          title={sl.analytics.byStage}
          items={Object.entries(summary.byStage).map(([stage, count]) => ({
            label: pipelineStageLabels[stage as keyof typeof pipelineStageLabels],
            count,
          }))}
        />
        <BarList
          title={sl.analytics.bySource}
          items={Object.entries(summary.bySource).map(([source, count]) => ({
            label: leadSourceLabels[source as keyof typeof leadSourceLabels],
            count,
          }))}
        />
      </div>
    </div>
  );
}

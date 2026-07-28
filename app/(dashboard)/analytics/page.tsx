import { BarList } from "@/components/analytics/bar-list";
import { StatCard } from "@/components/analytics/stat-card";
import { getAnalyticsSummary } from "@/db/queries/analytics";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function AnalyticsPage() {
  const scope = await requireTrainer();
  const summary = await getAnalyticsSummary(scope);

  if (summary.totalLeads === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">{sl.analytics.title}</h1>
        <p className="text-muted-foreground">{sl.analytics.noData}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{sl.analytics.title}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={sl.analytics.totalLeads} value={summary.totalLeads} />
        <StatCard label={sl.analytics.newThisWeek} value={summary.newThisWeek} />
        <StatCard label={sl.analytics.conversionRate} value={`${Math.round(summary.conversionRate * 100)}%`} />
        <StatCard label={sl.analytics.stuckCount} value={summary.stuckCount} />
      </div>

      {summary.medianDaysInStage !== null && (
        <StatCard label={sl.analytics.medianDaysInStage} value={summary.medianDaysInStage.toFixed(1)} />
      )}

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

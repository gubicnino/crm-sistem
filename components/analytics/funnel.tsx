import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineStage } from "@/db/schema";
import { pipelineStageDotClasses } from "@/lib/badge-styles";

export interface FunnelStage {
  stage: PipelineStage;
  count: number;
}

/** One source's stage-by-stage cumulative reach, as a vertical bar list with
 *  drop-off % captions between consecutive stages. See
 *  db/queries/analytics.ts's getAnalyticsSummary for what "cumulative" means
 *  here (current-state based, not a true historical funnel — there's no
 *  stage-history table). */
export function Funnel({
  title,
  stages,
  stageLabels,
  dotClassName,
}: {
  title: string;
  stages: FunnelStage[];
  stageLabels: Record<PipelineStage, string>;
  dotClassName?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`size-2.5 shrink-0 rounded-full ${dotClassName ?? ""}`} />
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].count : null;
          const dropoff = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
          return (
            <div key={s.stage}>
              {i > 0 && dropoff !== null && <div className="py-0.5 pl-33 text-xs text-muted-foreground">↓ {dropoff}%</div>}
              <div className="flex items-center gap-2.5">
                <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">{stageLabels[s.stage]}</span>
                <div className="flex-1">
                  <div
                    className={`flex h-7 items-center rounded px-2.5 text-xs font-semibold text-white ${pipelineStageDotClasses[s.stage]}`}
                    style={{ width: `${Math.max(8, (s.count / max) * 100)}%` }}
                  >
                    {s.count}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FunnelSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

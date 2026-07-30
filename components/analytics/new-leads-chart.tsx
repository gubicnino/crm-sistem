import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sl } from "@/lib/strings";

const WIDTH = 760;
const HEIGHT = 190;
const BASELINE_Y = 178;
const TOP_PAD = 10;

/** Hand-rolled SVG line+area chart — no charting library (CLAUDE.md: no new
 *  deps without asking), same "plain SVG/div, no library" approach as
 *  components/analytics/bar-list.tsx and funnel.tsx. */
export function NewLeadsChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? WIDTH / (data.length - 1) : WIDTH;
  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = BASELINE_Y - (d.count / max) * (BASELINE_Y - TOP_PAD);
    return { x, y, ...d };
  });
  const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `0,${BASELINE_Y} ${linePath} ${WIDTH},${BASELINE_Y}`;

  // Every ~5th day, so labels don't overlap on a 30-day axis.
  const labelEvery = Math.max(1, Math.floor(data.length / 6));
  const labeledIndices = data.map((_, i) => i).filter((i) => i % labelEvery === 0 || i === data.length - 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{sl.analytics.newLeadsChartTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{sl.analytics.newLeadsChartSubtitle}</p>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block h-[190px] w-full">
          <line x1="0" y1={TOP_PAD} x2={WIDTH} y2={TOP_PAD} stroke="var(--color-border)" strokeWidth="1" />
          <line
            x1="0"
            y1={(TOP_PAD + BASELINE_Y) / 2}
            x2={WIDTH}
            y2={(TOP_PAD + BASELINE_Y) / 2}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <line x1="0" y1={BASELINE_Y} x2={WIDTH} y2={BASELINE_Y} stroke="var(--color-muted-foreground)" strokeWidth="1.2" />
          <polygon points={areaPath} fill="var(--color-primary)" opacity="0.08" />
          <polyline
            points={linePath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.length > 0 && (
            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="var(--color-primary)" />
          )}
        </svg>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          {labeledIndices.map((i) => (
            <span key={i}>
              {new Date(data[i].date).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" })}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

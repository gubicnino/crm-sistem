import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BarList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate text-muted-foreground">{item.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-medium">{item.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

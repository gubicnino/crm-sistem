import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatDelta {
  text: string;
  direction: "up" | "down" | "flat";
}

export function StatCard({ label, value, delta }: { label: string; value: string | number; delta?: StatDelta }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {delta && (
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1 text-xs font-medium",
              delta.direction === "up" && "text-success",
              delta.direction === "down" && "text-destructive",
              delta.direction === "flat" && "text-muted-foreground",
            )}
          >
            {delta.direction === "up" && (
              <span className="inline-block size-0 border-r-4 border-b-[6px] border-l-4 border-r-transparent border-b-success border-l-transparent" />
            )}
            {delta.direction === "down" && (
              <span className="inline-block size-0 border-t-[6px] border-r-4 border-l-4 border-t-destructive border-r-transparent border-l-transparent" />
            )}
            {delta.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

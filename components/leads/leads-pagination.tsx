import Link from "next/link";
import { Button } from "@/components/ui/button";
import { sl } from "@/lib/strings";
import { cn } from "@/lib/utils";

/** Server-rendered — pagination is a plain link/query-param change, no client state needed. */
export function LeadsPagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t px-1 pt-3 text-sm text-muted-foreground">
      <span>{sl.leads.paginationShowing(from, to, total)}</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            className={cn(page <= 1 && "pointer-events-none")}
            nativeButton={false}
            render={<Link href={buildHref(Math.max(1, page - 1))} />}
          >
            {sl.leads.paginationPrev}
          </Button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="icon-sm"
              className={cn("tabular-nums", p === page && "pointer-events-none")}
              nativeButton={false}
              render={<Link href={buildHref(p)} />}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            className={cn(page >= pageCount && "pointer-events-none")}
            nativeButton={false}
            render={<Link href={buildHref(Math.min(pageCount, page + 1))} />}
          >
            {sl.leads.paginationNext}
          </Button>
        </div>
      )}
    </div>
  );
}

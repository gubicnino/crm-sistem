import { Skeleton } from "@/components/ui/skeleton";

/** Shared across every dashboard route (no per-page loading.tsx) — shaped
 *  like the common PageHeader + card-list layout so it doesn't flash as a
 *  jarringly different silhouette before the real content swaps in. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

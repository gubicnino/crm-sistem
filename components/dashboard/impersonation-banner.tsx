import { exitImpersonationAction } from "@/lib/actions/admin";
import { sl } from "@/lib/strings";

/** Sticky, high-contrast bar shown across the whole dashboard while an admin
 *  is impersonating a trainer — deliberately impossible to mistake for normal
 *  chrome, since the whole point is that the operator never forgets they're
 *  writing into someone else's tenant. See lib/tenant.ts's getImpersonation(). */
export function ImpersonationBanner({ trainerName }: { trainerName: string | null }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between bg-amber-500 px-4 text-sm font-medium text-amber-950">
      <span>{sl.admin.viewingAs(trainerName ?? "—")}</span>
      <form action={exitImpersonationAction}>
        <button type="submit" className="underline underline-offset-2 hover:no-underline">
          {sl.admin.exitImpersonation}
        </button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getTrainer } from "@/db/queries/trainers";
import { logoutAction } from "@/lib/actions/auth";
import { requireTrainer } from "@/lib/tenant";
import { sl } from "@/lib/strings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const scope = await requireTrainer();
  const trainer = await getTrainer(scope);

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 flex-col gap-6 border-r p-4">
        <nav className="flex flex-col gap-1">
          <Link href="/leads" className="text-sm font-medium">
            {sl.nav.leads}
          </Link>
          <Link href="/pipeline" className="text-sm font-medium">
            {sl.nav.pipeline}
          </Link>
          <Link href="/analytics" className="text-sm font-medium">
            {sl.nav.analytics}
          </Link>
          <Link href="/settings" className="text-sm font-medium">
            {sl.nav.settings}
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {trainer && <p className="truncate text-xs text-muted-foreground">{trainer.name}</p>}
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              {sl.nav.logout}
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getTrainer } from "@/db/queries/trainers";
import { logoutAction } from "@/lib/actions/auth";
import { getImpersonation, requireTrainer } from "@/lib/tenant";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const scope = await requireTrainer();
  const [trainer, impersonation] = await Promise.all([getTrainer(scope), getImpersonation()]);

  return (
    <SidebarProvider>
      <AppSidebar trainerName={trainer?.name ?? null} logoutAction={logoutAction} />
      <SidebarInset>
        {impersonation && <ImpersonationBanner trainerName={trainer?.name ?? null} />}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

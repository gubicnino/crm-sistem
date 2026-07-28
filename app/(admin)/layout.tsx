import { requireAdmin } from "@/lib/tenant";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Redirects non-admins to /leads and unauthenticated visitors to /login —
  // see lib/tenant.ts. Deliberately no trainer sidebar here: an admin outside
  // impersonation has no tenant to show one for.
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b px-6">
        <span className="text-sm font-semibold">Trener Growth Sistem — Admin</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

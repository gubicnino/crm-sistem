"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, KanbanSquare, LogOut, Mail, Settings, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { sl } from "@/lib/strings";

const NAV_ITEMS = [
  { href: "/leads", label: sl.nav.leads, icon: Users },
  { href: "/pipeline", label: sl.nav.pipeline, icon: KanbanSquare },
  { href: "/applications", label: sl.nav.applications, icon: ClipboardList },
  { href: "/emails", label: sl.nav.emails, icon: Mail },
  { href: "/analytics", label: sl.nav.analytics, icon: BarChart3 },
  { href: "/settings", label: sl.nav.settings, icon: Settings },
] as const;

export function AppSidebar({
  trainerName,
  logoutAction,
}: {
  trainerName: string | null;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center px-2 text-sm font-semibold group-data-[collapsible=icon]:opacity-0">
          Trener Growth
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton isActive={isActive} tooltip={label} render={<Link href={href} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {trainerName && (
          <p className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:opacity-0">
            {trainerName}
          </p>
        )}
        <form action={logoutAction}>
          <SidebarMenuButton tooltip={sl.nav.logout} type="submit">
            <LogOut />
            <span>{sl.nav.logout}</span>
          </SidebarMenuButton>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

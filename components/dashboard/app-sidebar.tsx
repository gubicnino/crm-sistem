"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { initials } from "@/lib/display";
import { sl } from "@/lib/strings";
import { BarChart3, ClipboardList, HelpCircle, KanbanSquare, LogOut, Mail, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/leads", label: sl.nav.leads, icon: Users },
  { href: "/pipeline", label: sl.nav.pipeline, icon: KanbanSquare },
  { href: "/applications", label: sl.nav.applications, icon: ClipboardList },
  { href: "/emails", label: sl.nav.emails, icon: Mail },
  { href: "/analytics", label: sl.nav.analytics, icon: BarChart3 },
  { href: "/settings/questions", label: sl.nav.questions, icon: HelpCircle },
] as const;

export function AppSidebar({
  trainerName,
  logoutAction,
}: {
  trainerName: string | null;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  // Longest matching href wins — needed now that "/settings" and
  // "/settings/questions" overlap, so only one nav item lights up at a time.
  const activeHref = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;

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
                const isActive = href === activeHref;
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
          <div className="flex items-center gap-2 px-2 py-1">
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="bg-primary-tint text-primary-hover">
                {initials(trainerName, trainerName)}
              </AvatarFallback>
            </Avatar>
            <p className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:opacity-0">
              {trainerName}
            </p>
          </div>
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

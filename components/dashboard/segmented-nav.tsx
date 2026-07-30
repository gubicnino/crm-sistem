"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabsListVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Route-aware segmented control (visually a Tabs list) for pairs of pages
 * that are genuinely separate routes with independent server-side data
 * fetching — e.g. Emaili's "Vsi emaili" (/emails) vs "Sekvence"
 * (/emails/sequences). NOT the stateful Tabs component: active state comes
 * from usePathname(), same pattern components/dashboard/app-sidebar.tsx
 * already uses, not from client-side tab state.
 */
export function SegmentedNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // Longest matching href wins, so a nested route (e.g. /emails/sequences/new)
  // highlights its parent segment rather than lighting up every ancestor.
  const activeHref = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;

  return (
    <div className={cn(tabsListVariants(), "inline-flex")}>
      {items.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-0.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground",
              isActive && "bg-background text-foreground shadow-sm",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

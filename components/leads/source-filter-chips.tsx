"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LeadSource } from "@/db/schema";
import { sl } from "@/lib/strings";
import { cn } from "@/lib/utils";

const CHIPS: { value: LeadSource | "all"; label: string }[] = [
  { value: "all", label: sl.leads.filterChipAll },
  { value: "application", label: sl.leads.filterChipApplication },
  { value: "lead_magnet", label: sl.leads.filterChipLeadMagnet },
];

export function SourceFilterChips({ current }: { current?: LeadSource }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setSource(value: LeadSource | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("source");
    } else {
      params.set("source", value);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      {CHIPS.map((chip) => {
        const isActive = (current ?? "all") === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            onClick={() => setSource(chip.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-primary-tint bg-primary-tint text-primary-hover"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

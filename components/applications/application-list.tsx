"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import type { Lead } from "@/db/schema";
import type { LeadAnswers } from "@/db/types";
import { avatarTintClass, initials } from "@/lib/display";
import { sl } from "@/lib/strings";
import { cn } from "@/lib/utils";

function firstAnswerSnippet(answers: LeadAnswers | null): string {
  if (!answers) return sl.applications.snippetEmpty;
  const first = Object.values(answers)[0];
  if (first === undefined) return sl.applications.snippetEmpty;
  return Array.isArray(first) ? first.join(", ") : String(first);
}

export function ApplicationList({ applications, selectedLeadId }: { applications: Lead[]; selectedLeadId: string | null }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter(
      (lead) => (lead.name ?? "").toLowerCase().includes(term) || lead.email.toLowerCase().includes(term),
    );
  }, [applications, search]);

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="border-b p-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={sl.applications.searchPlaceholder}
        />
      </div>
      <div className="flex flex-col overflow-y-auto">
        {filtered.map((lead) => {
          const isSelected = lead.id === selectedLeadId;
          return (
            <Link
              key={lead.id}
              href={`/applications?lead=${lead.id}`}
              className={cn(
                "relative flex items-start gap-2.5 border-b px-3 py-3 last:border-b-0 hover:bg-muted",
                isSelected && "bg-primary-tint hover:bg-primary-tint",
              )}
            >
              {isSelected && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
              <Avatar size="sm" className="mt-0.5 shrink-0">
                <AvatarFallback className={avatarTintClass(lead.id)}>{initials(lead.name, lead.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{lead.name ?? lead.email}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {lead.createdAt.toLocaleDateString("sl-SI")}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{firstAnswerSnippet(lead.answers)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

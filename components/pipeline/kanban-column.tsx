"use client";

import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "@/components/pipeline/lead-card";
import type { Lead, PipelineStage } from "@/db/schema";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  label,
  leads,
  disabled,
}: {
  stage: PipelineStage;
  label: string;
  leads: Lead[];
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
        isOver && "bg-muted/60",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium">{label}</h2>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

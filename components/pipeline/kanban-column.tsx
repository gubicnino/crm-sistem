"use client";

import { useDroppable } from "@dnd-kit/core";
import { EditableStageLabel } from "@/components/pipeline/editable-stage-label";
import { LeadCard } from "@/components/pipeline/lead-card";
import type { Lead, PipelineStage } from "@/db/schema";
import { pipelineStageDotClasses } from "@/lib/badge-styles";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  label,
  leads,
  disabled,
  onRename,
}: {
  stage: PipelineStage;
  label: string;
  leads: Lead[];
  disabled?: boolean;
  onRename: (next: string) => void;
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
      <div className="flex items-center gap-2 px-1">
        <span className={cn("size-2 shrink-0 rounded-full", pipelineStageDotClasses[stage])} />
        <EditableStageLabel label={label} onSave={onRename} disabled={disabled} className="text-sm font-medium" />
        <span className="ml-auto rounded-full bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-foreground/10">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

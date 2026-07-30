"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { LeadCard } from "@/components/pipeline/lead-card";
import type { Lead } from "@/db/schema";
import { pipelineStageLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Separate drop target for the terminal "lost" stage — per CLAUDE.md's
 * kanban description, lost leads get their own area, not a 5th column.
 * Stays droppable while collapsed (auto-expands on drag-over) since this is
 * the drop target that fires cancelSequenceForLead — losing it would
 * silently disable the product's most important cancellation trigger.
 */
export function LostPanel({ leads, disabled }: { leads: Lead[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: "lost", disabled });

  // Auto-expand on drag-over, adjusted during rendering rather than in an
  // effect (React's documented pattern for reacting to one changing value).
  const [prevIsOver, setPrevIsOver] = useState(isOver);
  if (isOver !== prevIsOver) {
    setPrevIsOver(isOver);
    if (isOver) setOpen(true);
  }

  return (
    <div ref={setNodeRef} className={cn("rounded-lg border bg-card transition-colors", isOver && "bg-destructive-tint/40")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span className="size-2 shrink-0 rounded-full bg-destructive" />
        <span className="text-sm font-semibold">{pipelineStageLabels.lost}</span>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </button>
      {open && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-4">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="w-56 shrink-0">
                <LeadCard lead={lead} disabled={disabled} variant="lost" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

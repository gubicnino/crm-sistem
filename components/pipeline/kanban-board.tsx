"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/pipeline/kanban-column";
import { pipelineStageEnum, type Lead, type PipelineStage } from "@/db/schema";
import { moveLeadStageAction } from "@/lib/actions/leads";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";

type GroupedLeads = Record<PipelineStage, Lead[]>;

interface MoveAction {
  leadId: string;
  nextStage: PipelineStage;
}

export function KanbanBoard({ initialGrouped }: { initialGrouped: GroupedLeads }) {
  const [isPending, startTransition] = useTransition();
  const [grouped, applyOptimisticMove] = useOptimistic(
    initialGrouped,
    (state: GroupedLeads, { leadId, nextStage }: MoveAction): GroupedLeads => {
      const moved = Object.values(state)
        .flat()
        .find((lead) => lead.id === leadId);
      if (!moved) return state;

      const next = { ...state };
      for (const stage of pipelineStageEnum.enumValues) {
        next[stage] = state[stage].filter((lead) => lead.id !== leadId);
      }
      next[nextStage] = [...next[nextStage], { ...moved, stage: nextStage }];
      return next;
    },
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const nextStage = over.id as PipelineStage;
    const currentStage = (Object.keys(grouped) as PipelineStage[]).find((stage) =>
      grouped[stage].some((lead) => lead.id === leadId),
    );
    if (!currentStage || currentStage === nextStage) return;

    // One action per drag — Next 16 dispatches Server Actions sequentially
    // per client, so never batch multiple moves via Promise.all.
    startTransition(async () => {
      applyOptimisticMove({ leadId, nextStage });
      const result = await moveLeadStageAction(leadId, nextStage);
      if (!result.ok) {
        // No manual revert needed: the optimistic state only holds while this
        // transition is pending, and moveLeadStageAction only calls
        // next/cache's refresh() on success — a failure here leaves the real
        // server state (and therefore the reverted UI) untouched.
        toast.error(sl.errors.unexpected);
      }
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipelineStageEnum.enumValues.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            label={pipelineStageLabels[stage]}
            leads={grouped[stage]}
            disabled={isPending}
          />
        ))}
      </div>
    </DndContext>
  );
}

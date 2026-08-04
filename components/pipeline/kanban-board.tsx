"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { KanbanColumn } from "@/components/pipeline/kanban-column";
import { LostPanel } from "@/components/pipeline/lost-panel";
import { pipelineStageEnum, type Lead, type PipelineStage } from "@/db/schema";
import { moveLeadStageAction } from "@/lib/actions/leads";
import { updateStageLabelsAction } from "@/lib/actions/settings";
import { ACTIVE_PIPELINE_STAGES } from "@/lib/pipeline";
import { sl } from "@/lib/strings";

type GroupedLeads = Record<PipelineStage, Lead[]>;
type StageLabels = Record<PipelineStage, string>;

interface MoveAction {
  leadId: string;
  nextStage: PipelineStage;
}

export function KanbanBoard({
  initialGrouped,
  initialStageLabels,
}: {
  initialGrouped: GroupedLeads;
  initialStageLabels: StageLabels;
}) {
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

  const [stageLabels, applyOptimisticLabel] = useOptimistic(
    initialStageLabels,
    (state: StageLabels, { stage, label }: { stage: PipelineStage; label: string }): StageLabels => ({
      ...state,
      [stage]: label,
    }),
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

  function handleRename(stage: PipelineStage, next: string) {
    startTransition(async () => {
      applyOptimisticLabel({ stage, label: next });
      const result = await updateStageLabelsAction({ ...stageLabels, [stage]: next });
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
      }
    });
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 overflow-x-auto pb-1">
          {ACTIVE_PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              label={stageLabels[stage]}
              leads={grouped[stage]}
              disabled={isPending}
              onRename={(next) => handleRename(stage, next)}
            />
          ))}
        </div>
        <LostPanel
          label={stageLabels.lost}
          leads={grouped.lost}
          disabled={isPending}
          onRename={(next) => handleRename("lost", next)}
        />
      </div>
    </DndContext>
  );
}

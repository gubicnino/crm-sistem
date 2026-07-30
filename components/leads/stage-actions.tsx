"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pipelineStageEnum, type PipelineStage } from "@/db/schema";
import { moveLeadStageAction, stopSequenceAction } from "@/lib/actions/leads";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";

export function StageActions({ leadId, currentStage }: { leadId: string; currentStage: PipelineStage }) {
  const [isPending, startTransition] = useTransition();

  function handleStageChange(next: PipelineStage | null) {
    if (!next) return;
    startTransition(async () => {
      const result = await moveLeadStageAction(leadId, next);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
      }
    });
  }

  function handleStopSequence() {
    startTransition(async () => {
      const result = await stopSequenceAction(leadId);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
        return;
      }
      toast.success(sl.leads.stopSequenceConfirm);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={currentStage} onValueChange={handleStageChange} disabled={isPending}>
        <SelectTrigger size="sm" aria-label={sl.leads.stageLabel}>
          <SelectValue>{(value: PipelineStage) => pipelineStageLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {pipelineStageEnum.enumValues.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {pipelineStageLabels[stage]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={handleStopSequence} disabled={isPending}>
        {sl.leads.stopSequence}
      </Button>
    </div>
  );
}

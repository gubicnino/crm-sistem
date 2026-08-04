"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmailSequenceSummary } from "@/db/queries/email-sequences";
import type { PipelineStage } from "@/db/schema";
import { setEmailSequenceEnabledAction } from "@/lib/actions/email-sequences";
import { leadSourceLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";

function ToggleEnabledButton({ sequenceId, enabled }: { sequenceId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await setEmailSequenceEnabledAction(sequenceId, !enabled);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {enabled ? sl.emails.sequenceDisable : sl.emails.sequenceEnable}
    </Button>
  );
}

function triggerLabel(sequence: EmailSequenceSummary, stageLabels: Record<PipelineStage, string>): string {
  if (sequence.triggerType === "stage_entered") {
    return `${sl.emails.sequenceTriggerTypeStageEntered} · ${sequence.triggerStage ? stageLabels[sequence.triggerStage] : ""}`;
  }
  return `${sl.emails.sequenceTriggerTypeLeadCreated} · ${sequence.triggerSource ? leadSourceLabels[sequence.triggerSource] : sl.emails.sequenceTriggerAnySource}`;
}

export function SequenceList({
  sequences,
  stageLabels,
}: {
  sequences: EmailSequenceSummary[];
  stageLabels: Record<PipelineStage, string>;
}) {
  if (sequences.length === 0) {
    return <p className="text-muted-foreground">{sl.emails.sequencesEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {sequences.map((sequence) => (
        <div key={sequence.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <Link href={`/emails/sequences/${sequence.id}`} className="font-medium hover:underline">
            {sequence.name}
          </Link>
          <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {triggerLabel(sequence, stageLabels)}
          </span>
          <span className="text-xs text-muted-foreground">
            {sl.emails.sequenceColumnSteps}: {sequence.stepCount}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Badge
              variant="secondary"
              className={sequence.enabled ? "bg-success-tint text-success" : "bg-secondary text-muted-foreground"}
            >
              {sequence.enabled ? sl.emails.sequenceStatusEnabled : sl.emails.sequenceStatusDisabled}
            </Badge>
            <ToggleEnabledButton sequenceId={sequence.id} enabled={sequence.enabled} />
            <Button
              variant="outline"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={`/emails/sequences/${sequence.id}`} aria-label={sequence.name} />}
            >
              <ChevronRight className="size-4" />
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}

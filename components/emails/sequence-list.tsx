"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmailSequenceSummary } from "@/db/queries/email-sequences";
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

export function SequenceList({ sequences }: { sequences: EmailSequenceSummary[] }) {
  if (sequences.length === 0) {
    return <p className="text-muted-foreground">{sl.emails.sequencesEmpty}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{sl.emails.sequenceColumnName}</TableHead>
          <TableHead>{sl.emails.sequenceColumnTrigger}</TableHead>
          <TableHead>{sl.emails.sequenceColumnSteps}</TableHead>
          <TableHead>{sl.emails.sequenceColumnStatus}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sequences.map((sequence) => (
          <TableRow key={sequence.id}>
            <TableCell>
              <Link href={`/emails/sequences/${sequence.id}`} className="font-medium hover:underline">
                {sequence.name}
              </Link>
            </TableCell>
            <TableCell>
              {sequence.triggerSource ? leadSourceLabels[sequence.triggerSource] : sl.emails.sequenceTriggerAnySource}
            </TableCell>
            <TableCell>{sequence.stepCount}</TableCell>
            <TableCell>
              <Badge variant={sequence.enabled ? "default" : "secondary"}>
                {sequence.enabled ? sl.emails.sequenceStatusEnabled : sl.emails.sequenceStatusDisabled}
              </Badge>
            </TableCell>
            <TableCell>
              <ToggleEnabledButton sequenceId={sequence.id} enabled={sequence.enabled} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

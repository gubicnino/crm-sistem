"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { stopSequenceAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";

export function CancelSequenceButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
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
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {sl.emails.cancelButton}
    </Button>
  );
}

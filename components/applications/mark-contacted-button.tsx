"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moveLeadStageAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";

export function MarkContactedButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await moveLeadStageAction(leadId, "contacted");
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
        return;
      }
      toast.success(sl.applications.markContactedSuccess);
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {sl.applications.markContacted}
    </Button>
  );
}

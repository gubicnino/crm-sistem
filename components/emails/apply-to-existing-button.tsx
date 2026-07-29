"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { applySequenceToExistingLeadsAction } from "@/lib/actions/email-sequences";
import { sl } from "@/lib/strings";

/** Hidden when nobody is enrolled yet — a brand-new or never-triggered
 *  sequence has nothing to re-apply. */
export function ApplyToExistingButton({ sequenceId, enrolledCount }: { sequenceId: string; enrolledCount: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (enrolledCount === 0) return null;

  function handleConfirm() {
    startTransition(async () => {
      const result = await applySequenceToExistingLeadsAction(sequenceId);
      if (!result.ok) {
        toast.error(result.error === "applyLimitExceeded" ? sl.emails.applyLimitExceeded : sl.errors.unexpected);
        return;
      }
      setOpen(false);
      toast.success(sl.emails.applySuccess(result.affectedLeads));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {sl.emails.applyToExisting(enrolledCount)}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.emails.applyConfirmTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{sl.emails.applyConfirmBody(enrolledCount)}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {sl.leads.cancelButton}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {sl.emails.applyConfirmButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

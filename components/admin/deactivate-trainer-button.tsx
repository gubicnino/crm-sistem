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
import { deactivateTrainerAction, reactivateTrainerAction } from "@/lib/actions/admin";
import { sl } from "@/lib/strings";

export function DeactivateTrainerButton({ trainerId, isActive }: { trainerId: string; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const action = isActive ? deactivateTrainerAction : reactivateTrainerAction;
      const result = await action(trainerId);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={isActive ? "destructive" : "outline"} size="sm" />}>
        {isActive ? sl.admin.deactivate : sl.admin.reactivate}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isActive ? sl.admin.deactivateConfirmTitle : sl.admin.reactivateConfirmTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {isActive ? sl.admin.deactivateConfirmBody : sl.admin.reactivateConfirmBody}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {sl.leads.cancelButton}
          </Button>
          <Button variant={isActive ? "destructive" : "default"} onClick={handleConfirm} disabled={isPending}>
            {isActive ? sl.admin.deactivate : sl.admin.reactivate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

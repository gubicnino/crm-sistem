"use client";

import { useRouter } from "next/navigation";
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
import { deleteLeadAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteLeadAction(leadId);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
        return;
      }
      setOpen(false);
      router.push("/leads");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>{sl.leads.deleteLead}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.leads.deleteLeadConfirmTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{sl.leads.deleteLeadConfirmBody}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            {sl.leads.cancelButton}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {sl.leads.deleteLead}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

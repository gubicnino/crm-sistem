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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setTrainerFromEmailAction } from "@/lib/actions/admin";
import { sl } from "@/lib/strings";

export function FromEmailDialog({ trainerId, currentValue }: { trainerId: string; currentValue: string | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(next: string | null) {
    startTransition(async () => {
      const result = await setTrainerFromEmailAction(trainerId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      toast.success(sl.admin.fromEmailSaved);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(currentValue ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{sl.admin.setFromEmail}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.admin.setFromEmail}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from-email">{sl.admin.columnFromEmail}</Label>
          <Input
            id="from-email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={sl.admin.fromEmailPlaceholder}
          />
          <p className="text-xs text-muted-foreground">{sl.admin.fromEmailHint}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={isPending} onClick={() => save(null)}>
            {sl.admin.fromEmailClear}
          </Button>
          <Button disabled={isPending} onClick={() => save(value)}>
            {sl.admin.fromEmailSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

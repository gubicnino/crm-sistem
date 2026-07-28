"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { createLeadAction } from "@/lib/actions/leads";
import { sl } from "@/lib/strings";
import { manualLeadSchema, type ManualLeadInput } from "@/lib/validation/leads";

export function CreateLeadDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualLeadInput>({ resolver: zodResolver(manualLeadSchema) });

  async function onSubmit(values: ManualLeadInput) {
    setIsSubmitting(true);
    const result = await createLeadAction(values);
    setIsSubmitting(false);
    if (!result.ok) {
      toast.error(result.error === "duplicateEmail" ? sl.leads.duplicateEmail : sl.errors.validation);
      return;
    }
    toast.success(sl.leads.createSuccess);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>{sl.leads.addLead}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sl.leads.addLead}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.columnName}</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.columnEmail}</Label>
            <Input {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.leads.phoneLabel}</Label>
            <Input {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {sl.leads.saveLead}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

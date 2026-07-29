"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmailSequence, EmailSequenceStep, LeadSource } from "@/db/schema";
import { createEmailSequenceAction, updateEmailSequenceAction } from "@/lib/actions/email-sequences";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { leadSourceLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { emailSequenceFormSchema } from "@/lib/validation/email-sequences";

interface StepFormValues {
  id?: string;
  subject: string;
  heading: string;
  paragraphsText: string;
  dayOffset: number;
}

interface SequenceFormValues {
  name: string;
  triggerSource: LeadSource | "any";
  enabled: boolean;
  steps: StepFormValues[];
}

const stepFormSchema = z.object({
  id: z.uuid().optional(),
  subject: z.string().trim().min(1, { error: "Zadeva je obvezna." }).max(200),
  heading: z.string().trim().min(1, { error: "Naslov je obvezen." }).max(200),
  paragraphsText: z.string().trim().min(1, { error: "Dodajte vsaj en odstavek besedila." }),
  dayOffset: z
    .number()
    .int()
    .min(0, { error: "Dan mora biti 0 ali več." })
    .max(MAX_SCHEDULE_DAYS, { error: `Dan ne sme biti večji od ${MAX_SCHEDULE_DAYS}.` }),
});

const sequenceFormSchema = z.object({
  name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
  triggerSource: z.enum(["application", "lead_magnet", "any"]),
  enabled: z.boolean(),
  steps: z.array(stepFormSchema).min(1, { error: "Sekvenca potrebuje vsaj en korak." }).max(MAX_STEPS_PER_SEQUENCE),
});

function paragraphsToText(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

function textToParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const EMPTY_STEP: StepFormValues = { subject: "", heading: "", paragraphsText: "", dayOffset: 0 };

export function SequenceForm({ sequence, steps }: { sequence?: EmailSequence; steps?: EmailSequenceStep[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SequenceFormValues>({
    resolver: zodResolver(sequenceFormSchema),
    defaultValues: {
      name: sequence?.name ?? "",
      triggerSource: sequence?.triggerSource ?? "any",
      enabled: sequence?.enabled ?? true,
      steps:
        steps && steps.length > 0
          ? steps.map((step) => ({
              id: step.id,
              subject: step.subject,
              heading: step.heading,
              paragraphsText: paragraphsToText(step.paragraphs),
              dayOffset: step.dayOffset,
            }))
          : [EMPTY_STEP],
    },
  });

  // keyName avoids react-hook-form silently overwriting a step's own `id`
  // (a real email_sequence_steps.id) with its internal row key.
  const { fields, append, remove, move } = useFieldArray({ control, name: "steps", keyName: "_rowKey" });

  async function onSubmit(values: SequenceFormValues) {
    setIsSaving(true);
    const payload = {
      name: values.name,
      triggerSource: values.triggerSource === "any" ? null : values.triggerSource,
      enabled: values.enabled,
      steps: values.steps.map((step) => ({
        id: step.id,
        subject: step.subject,
        heading: step.heading,
        paragraphs: textToParagraphs(step.paragraphsText),
        dayOffset: step.dayOffset,
      })),
    };

    // Re-validates the transformed payload (paragraphsText -> paragraphs[])
    // against the same schema the server action re-validates — catches a
    // paragraph split producing zero paragraphs before the round trip.
    const parsed = emailSequenceFormSchema.safeParse(payload);
    if (!parsed.success) {
      setIsSaving(false);
      toast.error(sl.errors.validation);
      return;
    }

    const result = sequence
      ? await updateEmailSequenceAction(sequence.id, parsed.data)
      : await createEmailSequenceAction(parsed.data);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error === "sequenceLimit" ? sl.emails.sequenceLimitReached : sl.errors.validation);
      return;
    }
    toast.success(sl.settings.savedSuccess);
    router.push("/emails/sequences");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{sl.emails.sequenceDetailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sequenceNameLabel}</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sequenceTriggerLabel}</Label>
            <Controller
              control={control}
              name="triggerSource"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{sl.emails.sequenceTriggerAnySource}</SelectItem>
                    <SelectItem value="application">{leadSourceLabels.application}</SelectItem>
                    <SelectItem value="lead_magnet">{leadSourceLabels.lead_magnet}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register("enabled")} className="size-4" />
            <Label>{sl.emails.sequenceEnabledLabel}</Label>
          </div>
        </CardContent>
      </Card>

      {fields.map((field, index) => {
        const rowErrors = errors.steps?.[index];
        return (
          <Card key={field._rowKey}>
            <CardHeader>
              <CardTitle>{sl.emails.stepTitle(index + 1)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepDayOffsetLabel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={MAX_SCHEDULE_DAYS}
                    {...register(`steps.${index}.dayOffset`, { valueAsNumber: true })}
                  />
                  {rowErrors?.dayOffset && <p className="text-xs text-destructive">{rowErrors.dayOffset.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepSubjectLabel}</Label>
                  <Input {...register(`steps.${index}.subject`)} />
                  {rowErrors?.subject && <p className="text-xs text-destructive">{rowErrors.subject.message}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>{sl.emails.stepHeadingLabel}</Label>
                <Input {...register(`steps.${index}.heading`)} />
                {rowErrors?.heading && <p className="text-xs text-destructive">{rowErrors.heading.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label>{sl.emails.stepBodyLabel}</Label>
                <p className="text-xs text-muted-foreground">{sl.emails.stepBodyHint}</p>
                <Textarea rows={6} {...register(`steps.${index}.paragraphsText`)} />
                {rowErrors?.paragraphsText && (
                  <p className="text-xs text-destructive">{rowErrors.paragraphsText.message}</p>
                )}
              </div>
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    {sl.emails.stepMoveUp}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    {sl.emails.stepMoveDown}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  {sl.emails.stepDelete}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => append(EMPTY_STEP)}
        disabled={fields.length >= MAX_STEPS_PER_SEQUENCE}
        className="self-start"
      >
        {sl.emails.stepAdd}
      </Button>

      <Button type="submit" disabled={isSaving} className="self-end">
        {sl.emails.sequenceSave}
      </Button>
    </form>
  );
}

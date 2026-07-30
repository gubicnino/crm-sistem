"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { StepPreview } from "@/components/emails/step-preview";
import type { EmailSequence, EmailSequenceStep, LeadSource, PipelineStage } from "@/db/schema";
import type { EmailDocNode } from "@/db/types";
import { createEmailSequenceAction, updateEmailSequenceAction } from "@/lib/actions/email-sequences";
import { MAX_SCHEDULE_DAYS, MAX_STEPS_PER_SEQUENCE } from "@/lib/email/constants";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { isTerminalStage, PIPELINE_STAGES } from "@/lib/pipeline";
import { sl } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { emailSequenceFormSchema } from "@/lib/validation/email-sequences";

/** Only these can ever be a sequence's triggerStage or a step's
 *  sendOnlyIfStage — client/lost are excluded here for the same reason the
 *  server rejects them (lib/validation/email-sequences.ts): both already
 *  have a mandatory, competing action on that transition (cancellation). */
const NON_TERMINAL_STAGES = PIPELINE_STAGES.filter((stage) => !isTerminalStage(stage));

interface StepFormValues {
  id?: string;
  subject: string;
  body: EmailDocNode;
  dayOffset: number;
  sendOnlyIfStage: PipelineStage[];
}

type SequenceFormValues = {
  name: string;
  enabled: boolean;
  steps: StepFormValues[];
} & (
  | { triggerType: "lead_created"; triggerSource: LeadSource | "any" }
  | { triggerType: "stage_entered"; triggerStage: PipelineStage }
);

/**
 * `body` here is a light shape check (typed against the general
 * EmailDocNode, not the Zod-inferred narrow literal type emailDocSchema
 * produces) — just enough for react-hook-form's own client-side error
 * display. The real security boundary is emailDocSchema's full recursive
 * validation, applied to the transformed payload in onSubmit below and
 * authoritatively again server-side in the Server Action; using the real
 * schema here would fight RichTextEditor's onChange, which is typed to
 * emit an EmailDocNode (Tiptap's own getJSON() is untyped by nature).
 */
const stepFormSchema = z.object({
  id: z.uuid().optional(),
  subject: z.string().trim().min(1, { error: "Zadeva je obvezna." }).max(200),
  body: z.custom<EmailDocNode>(
    (value) => typeof value === "object" && value !== null && (value as EmailDocNode).type === "doc",
    { error: "Dodajte vsaj en odstavek besedila." },
  ),
  dayOffset: z
    .number()
    .int()
    .min(0, { error: "Dan mora biti 0 ali več." })
    .max(MAX_SCHEDULE_DAYS, { error: `Dan ne sme biti večji od ${MAX_SCHEDULE_DAYS}.` }),
  sendOnlyIfStage: z.array(z.enum(PIPELINE_STAGES)),
});

const sequenceFormSchema = z.discriminatedUnion("triggerType", [
  z.object({
    triggerType: z.literal("lead_created"),
    triggerSource: z.enum(["application", "lead_magnet", "any"]),
    name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
    enabled: z.boolean(),
    steps: z.array(stepFormSchema).min(1, { error: "Sekvenca potrebuje vsaj en korak." }).max(MAX_STEPS_PER_SEQUENCE),
  }),
  z.object({
    triggerType: z.literal("stage_entered"),
    triggerStage: z.enum(NON_TERMINAL_STAGES),
    name: z.string().trim().min(1, { error: "Ime sekvence je obvezno." }).max(100),
    enabled: z.boolean(),
    steps: z.array(stepFormSchema).min(1, { error: "Sekvenca potrebuje vsaj en korak." }).max(MAX_STEPS_PER_SEQUENCE),
  }),
]);

const EMPTY_BODY: EmailDocNode = { type: "doc", content: [{ type: "paragraph", content: [] }] };
const EMPTY_STEP: StepFormValues = { subject: "", body: EMPTY_BODY, dayOffset: 0, sendOnlyIfStage: [] };

export function SequenceForm({
  sequence,
  steps,
  trainerName,
}: {
  sequence?: EmailSequence;
  steps?: EmailSequenceStep[];
  trainerName: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const defaultStepValues: StepFormValues[] =
    steps && steps.length > 0
      ? steps.map((step) => ({
          id: step.id,
          subject: step.subject,
          body: step.body,
          dayOffset: step.dayOffset,
          sendOnlyIfStage: step.sendOnlyIfStage ?? [],
        }))
      : [EMPTY_STEP];

  const defaultValues: SequenceFormValues =
    sequence?.triggerType === "stage_entered"
      ? {
          triggerType: "stage_entered",
          triggerStage: sequence.triggerStage ?? "contacted",
          name: sequence.name,
          enabled: sequence.enabled,
          steps: defaultStepValues,
        }
      : {
          triggerType: "lead_created",
          triggerSource: sequence?.triggerSource ?? "any",
          name: sequence?.name ?? "",
          enabled: sequence?.enabled ?? true,
          steps: defaultStepValues,
        };

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SequenceFormValues>({
    resolver: zodResolver(sequenceFormSchema),
    defaultValues,
  });

  // keyName avoids react-hook-form silently overwriting a step's own `id`
  // (a real email_sequence_steps.id) with its internal row key.
  const { fields, append, remove, move } = useFieldArray({ control, name: "steps", keyName: "_rowKey" });
  const triggerType = watch("triggerType");

  async function onSubmit(values: SequenceFormValues) {
    setIsSaving(true);
    const payload = {
      name: values.name,
      enabled: values.enabled,
      ...(values.triggerType === "lead_created"
        ? { triggerType: "lead_created" as const, triggerSource: values.triggerSource === "any" ? null : values.triggerSource }
        : { triggerType: "stage_entered" as const, triggerStage: values.triggerStage }),
      steps: values.steps.map((step) => ({
        id: step.id,
        subject: step.subject,
        body: step.body,
        dayOffset: step.dayOffset,
        sendOnlyIfStage: step.sendOnlyIfStage.length > 0 ? step.sendOnlyIfStage : null,
      })),
    };

    // Re-validates against the same schema the server action re-validates —
    // catches an invalid body (e.g. an empty document) before the round trip.
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
            <Label>{sl.emails.sequenceTriggerTypeLabel}</Label>
            <Controller
              control={control}
              name="triggerType"
              render={({ field }) => (
                <div className="flex gap-2">
                  {(
                    [
                      ["lead_created", sl.emails.sequenceTriggerTypeLeadCreated],
                      ["stage_entered", sl.emails.sequenceTriggerTypeStageEntered],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => field.onChange(value)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        field.value === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
          {triggerType === "lead_created" ? (
            <div className="flex flex-col gap-1">
              <Label>{sl.emails.sequenceTriggerLabel}</Label>
              <Controller
                control={control}
                name="triggerSource"
                render={({ field }) => (
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <SelectTrigger size="sm" aria-label={sl.emails.sequenceTriggerLabel}>
                      <SelectValue>
                        {(value: "any" | LeadSource) =>
                          value === "any" ? sl.emails.sequenceTriggerAnySource : leadSourceLabels[value]
                        }
                      </SelectValue>
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
          ) : (
            <div className="flex flex-col gap-1">
              <Label>{sl.emails.sequenceTriggerStageLabel}</Label>
              <Controller
                control={control}
                name="triggerStage"
                render={({ field }) => (
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <SelectTrigger size="sm" aria-label={sl.emails.sequenceTriggerStageLabel}>
                      <SelectValue>{(value: PipelineStage) => pipelineStageLabels[value]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {NON_TERMINAL_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {pipelineStageLabels[stage]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
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
                    <Label>{sl.emails.stepBodyLabel}</Label>
                    <Controller
                      control={control}
                      name={`steps.${index}.body`}
                      render={({ field: bodyField }) => (
                        <RichTextEditor value={bodyField.value} onChange={bodyField.onChange} />
                      )}
                    />
                    {rowErrors?.body && <p className="text-xs text-destructive">{sl.errors.validation}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>{sl.emails.stepConditionLabel}</Label>
                    <p className="text-xs text-muted-foreground">{sl.emails.stepConditionHint}</p>
                    <Controller
                      control={control}
                      name={`steps.${index}.sendOnlyIfStage`}
                      render={({ field: conditionField }) => (
                        <div className="flex flex-wrap gap-3">
                          {NON_TERMINAL_STAGES.map((stage) => {
                            const checked = conditionField.value.includes(stage);
                            return (
                              <label key={stage} className="flex items-center gap-1.5 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(next) => {
                                    conditionField.onChange(
                                      next
                                        ? [...conditionField.value, stage]
                                        : conditionField.value.filter((s) => s !== stage),
                                    );
                                  }}
                                />
                                {pipelineStageLabels[stage]}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepPreviewLabel}</Label>
                  <StepPreview
                    subject={watch(`steps.${index}.subject`)}
                    body={watch(`steps.${index}.body`)}
                    trainerName={trainerName}
                  />
                </div>
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

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApplicationQuestion } from "@/db/types";
import { updateApplicationQuestionsAction } from "@/lib/actions/settings";
import { sl } from "@/lib/strings";
import { applicationQuestionsSchema } from "@/lib/validation/questions";

type FormValues = { questions: ApplicationQuestion[] };

const TYPE_LABELS: Record<ApplicationQuestion["type"], string> = {
  text: sl.settings.typeText,
  textarea: sl.settings.typeTextarea,
  select: sl.settings.typeSelect,
  checkbox: sl.settings.typeCheckbox,
};

const EMPTY_QUESTION: ApplicationQuestion = { id: "", label: "", type: "text", required: false };

export function QuestionsEditor({ initialQuestions }: { initialQuestions: ApplicationQuestion[] }) {
  // Ids present when the page loaded — these get a disabled id input, since
  // changing an existing id would orphan historical leads.answers keys (see
  // lib/validation/questions.ts). Newly appended rows are never in this set.
  const [existingIds] = useState(() => new Set(initialQuestions.map((q) => q.id)));
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(z.object({ questions: applicationQuestionsSchema })),
    defaultValues: { questions: initialQuestions },
  });

  // keyName avoids react-hook-form silently overwriting our data's own `id`
  // field with its internal row key — the two would otherwise collide.
  const { fields, append, remove } = useFieldArray({ control, name: "questions", keyName: "_rowKey" });

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    const result = await updateApplicationQuestionsAction(values.questions);
    setIsSaving(false);
    if (!result.ok) {
      toast.error(sl.errors.validation);
      return;
    }
    toast.success(sl.settings.savedSuccess);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sl.settings.questionsTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{sl.settings.questionsHint}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {fields.map((field, index) => {
            const isExisting = existingIds.has(field.id);
            const currentType = watch(`questions.${index}.type`);
            const rowErrors = errors.questions?.[index];

            return (
              <div key={field._rowKey} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label>{sl.settings.questionIdLabel}</Label>
                    <Input {...register(`questions.${index}.id`)} disabled={isExisting} />
                    {rowErrors?.id && <p className="text-xs text-destructive">{rowErrors.id.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>{sl.settings.questionLabelLabel}</Label>
                    <Input {...register(`questions.${index}.label`)} />
                    {rowErrors?.label && <p className="text-xs text-destructive">{rowErrors.label.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label>{sl.settings.questionTypeLabel}</Label>
                    <Controller
                      control={control}
                      name={`questions.${index}.type`}
                      render={({ field: typeField }) => (
                        <Select value={typeField.value} onValueChange={typeField.onChange}>
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TYPE_LABELS) as ApplicationQuestion["type"][]).map((type) => (
                              <SelectItem key={type} value={type}>
                                {TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" {...register(`questions.${index}.required`)} className="size-4" />
                    <Label>{sl.settings.questionRequiredLabel}</Label>
                  </div>
                </div>

                {currentType === "select" && (
                  <div className="flex flex-col gap-1">
                    <Label>{sl.settings.questionOptionsLabel}</Label>
                    <Controller
                      control={control}
                      name={`questions.${index}.options`}
                      render={({ field: optionsField }) => (
                        <Input
                          value={(optionsField.value ?? []).join(", ")}
                          onChange={(e) =>
                            optionsField.onChange(
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      )}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-end text-destructive"
                  onClick={() => remove(index)}
                >
                  {sl.settings.deleteQuestion}
                </Button>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={() => append(EMPTY_QUESTION)} className="self-start">
            {sl.settings.addQuestion}
          </Button>

          <Button type="submit" disabled={isSaving} className="self-end">
            {sl.settings.saveQuestions}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

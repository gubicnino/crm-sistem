"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPreview } from "@/components/settings/form-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ApplicationQuestion } from "@/db/types";
import { updateApplicationQuestionsAction } from "@/lib/actions/settings";
import { slugifyQuestionId } from "@/lib/display";
import { sl } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { applicationQuestionsSchema } from "@/lib/validation/questions";

// Relaxed vs. the real applicationQuestionSchema: `id` is empty for a new,
// not-yet-saved question (hidden from the trainer entirely) and only gets
// filled in — once — right before the real schema re-validates at submit.
// See slugifyQuestionId's doc for why it's never regenerated after that.
const formQuestionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, { error: "Naslov vprašanja je obvezen." }).max(200),
  type: z.enum(["text", "textarea", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});
type FormValues = { questions: z.infer<typeof formQuestionSchema>[] };

const TYPE_LABELS: Record<ApplicationQuestion["type"], string> = {
  text: sl.settings.typeText,
  textarea: sl.settings.typeTextarea,
  select: sl.settings.typeSelect,
  checkbox: sl.settings.typeCheckbox,
};
const TYPES = Object.keys(TYPE_LABELS) as ApplicationQuestion["type"][];

const EMPTY_QUESTION: ApplicationQuestion = { id: "", label: "", type: "text", required: false };

export function QuestionsEditor({ initialQuestions }: { initialQuestions: ApplicationQuestion[] }) {
  const [isSaving, setIsSaving] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(z.object({ questions: z.array(formQuestionSchema).max(40) })),
    defaultValues: { questions: initialQuestions },
  });

  // keyName avoids react-hook-form silently overwriting our data's own `id`
  // field with its internal row key — the two would otherwise collide.
  const { fields, append, remove, move } = useFieldArray({ control, name: "questions", keyName: "_rowKey" });
  const liveQuestions = watch("questions");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f._rowKey === active.id);
    const newIndex = fields.findIndex((f) => f._rowKey === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    move(oldIndex, newIndex);
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    const usedIds = new Set(initialQuestions.map((q) => q.id));
    const questions: ApplicationQuestion[] = values.questions.map((q) => {
      if (q.id) return q as ApplicationQuestion;
      const id = slugifyQuestionId(q.label, usedIds);
      usedIds.add(id);
      return { ...q, id } as ApplicationQuestion;
    });

    const parsed = applicationQuestionsSchema.safeParse(questions);
    if (!parsed.success) {
      setIsSaving(false);
      toast.error(sl.errors.validation);
      return;
    }

    const result = await updateApplicationQuestionsAction(parsed.data);
    setIsSaving(false);
    if (!result.ok) {
      toast.error(sl.errors.validation);
      return;
    }
    toast.success(sl.settings.savedSuccess);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{sl.settings.questionsHint}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f._rowKey)} strategy={verticalListSortingStrategy}>
              {fields.map((field, index) => {
                const rowErrors = errors.questions?.[index];
                const currentType = liveQuestions[index]?.type;
                const isExpanded = expandedKey === field._rowKey;
                return (
                  <SortableQuestionRow key={field._rowKey} rowKey={field._rowKey}>
                    <div className="rounded-lg border bg-card">
                      <div className="flex w-full items-center gap-3 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isExpanded ? null : field._rowKey)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {liveQuestions[index]?.label || sl.settings.previewUntitled}
                          </span>
                          <Badge variant="secondary" className="shrink-0 bg-secondary text-[11px] text-muted-foreground">
                            {TYPE_LABELS[currentType ?? "text"]}
                          </Badge>
                          {liveQuestions[index]?.required && (
                            <Badge variant="secondary" className="shrink-0 bg-hot-tint text-[11px] text-hot-foreground">
                              {sl.settings.requiredBadge}
                            </Badge>
                          )}
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10"
                          aria-label={sl.settings.deleteQuestion}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="flex flex-col gap-3 border-t p-3">
                          <div className="flex flex-col gap-1">
                            <Label>{sl.settings.questionLabelLabel}</Label>
                            <Input {...register(`questions.${index}.label`)} />
                            {rowErrors?.label && <p className="text-xs text-destructive">{rowErrors.label.message}</p>}
                          </div>

                          <div className="flex flex-col gap-1">
                            <Label>{sl.settings.questionTypeLabel}</Label>
                            <Controller
                              control={control}
                              name={`questions.${index}.type`}
                              render={({ field: typeField }) => (
                                <div className="flex flex-wrap gap-2">
                                  {TYPES.map((type) => (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() => typeField.onChange(type)}
                                      className={cn(
                                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                        typeField.value === type
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                                      )}
                                    >
                                      {TYPE_LABELS[type]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            />
                          </div>

                          {currentType === "select" && (
                            <div className="flex flex-col gap-1">
                              <Label>{sl.settings.questionOptionsLabel}</Label>
                              <Controller
                                control={control}
                                name={`questions.${index}.options`}
                                render={({ field: optionsField }) => (
                                  <OptionChips
                                    options={optionsField.value ?? []}
                                    onChange={optionsField.onChange}
                                  />
                                )}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Controller
                              control={control}
                              name={`questions.${index}.required`}
                              render={({ field: requiredField }) => (
                                <Switch checked={requiredField.value} onCheckedChange={requiredField.onChange} />
                              )}
                            />
                            <Label>{sl.settings.questionRequiredLabel}</Label>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableQuestionRow>
                );
              })}
            </SortableContext>
          </DndContext>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              append(EMPTY_QUESTION);
              setExpandedKey(null);
            }}
            className="mt-1 self-start"
          >
            {sl.settings.addQuestion}
          </Button>

          <Button type="submit" disabled={isSaving} className="mt-2 self-end">
            {sl.settings.saveQuestions}
          </Button>
        </form>
      </div>

      <FormPreview questions={liveQuestions} />
    </div>
  );
}

function SortableQuestionRow({ rowKey, children }: { rowKey: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowKey });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "z-10 opacity-70")}>
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="absolute top-2.5 -left-5.5 hidden cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing lg:block"
        aria-label={sl.settings.dragHandleLabel}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </div>
  );
}

function OptionChips({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function addOption() {
    const value = draft.trim();
    if (!value || options.includes(value)) return;
    onChange([...options, value]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, i) => (
        <span
          key={option}
          className="flex items-center gap-1.5 rounded-full bg-muted py-1 pr-1 pl-3 text-xs font-medium"
        >
          {option}
          <button
            type="button"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={sl.settings.removeOption}
          >
            ✕
          </button>
        </span>
      ))}
      <span className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder={sl.settings.addOption}
          className="h-7 w-36 rounded-full text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          {sl.settings.addOption}
        </Button>
      </span>
    </div>
  );
}

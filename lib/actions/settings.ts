"use server";

import { refresh } from "next/cache";
import { updateApplicationQuestions, updateStageLabels } from "@/db/queries/trainers";
import { requireTrainerOrThrow } from "@/lib/tenant";
import { applicationQuestionsSchema } from "@/lib/validation/questions";
import { stageLabelsSchema } from "@/lib/validation/pipeline";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateApplicationQuestionsAction(questions: unknown): Promise<ActionResult> {
  const parsed = applicationQuestionsSchema.safeParse(questions);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  await updateApplicationQuestions(scope, parsed.data);
  refresh();
  return { ok: true };
}

/** Always receives the FULL 5-key record — the caller (KanbanBoard) spreads
 *  its current stageLabels and overrides the one edited stage, matching
 *  updateApplicationQuestionsAction's full-document-replace convention. */
export async function updateStageLabelsAction(labels: unknown): Promise<ActionResult> {
  const parsed = stageLabelsSchema.safeParse(labels);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  await updateStageLabels(scope, parsed.data);
  refresh();
  return { ok: true };
}

"use server";

import { refresh } from "next/cache";
import { updateApplicationQuestions } from "@/db/queries/trainers";
import { requireTrainerOrThrow } from "@/lib/tenant";
import { applicationQuestionsSchema } from "@/lib/validation/questions";

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

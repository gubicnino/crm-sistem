"use server";

import { refresh } from "next/cache";
import type { PipelineStage } from "@/db/schema";
import { setLeadStage } from "@/db/queries/leads";
import { cancelSequenceForLead } from "@/lib/email/cancel";
import { requireTrainerOrThrow } from "@/lib/tenant";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Backs every stage-change UI path (kanban drag, detail dropdown) — always
 * through setLeadStage(), which is the only function allowed to write
 * `stage` and internally triggers cancellation on client/lost. One lead per
 * call; Next 16 dispatches Server Actions sequentially per client, so a
 * hypothetical bulk-move must be one action taking an array, never
 * Promise.all over N calls to this one.
 */
export async function moveLeadStageAction(leadId: string, nextStage: PipelineStage): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  try {
    await setLeadStage(scope, leadId, nextStage);
  } catch {
    return { ok: false, error: "unexpected" };
  }
  refresh();
  return { ok: true };
}

/** The trainer's manual "stop sequence" trigger — one of CLAUDE.md's four
 *  mandatory cancellation call sites. Cancels without changing `stage`. */
export async function stopSequenceAction(leadId: string): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  await cancelSequenceForLead(scope, leadId);
  refresh();
  return { ok: true };
}

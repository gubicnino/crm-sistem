"use server";

import { refresh } from "next/cache";
import type { PipelineStage } from "@/db/schema";
import { createLead, deleteLead, setLeadStage, updateLead } from "@/db/queries/leads";
import { cancelSequenceForLead } from "@/lib/email/cancel";
import { requireTrainerOrThrow } from "@/lib/tenant";
import { manualLeadSchema, type ManualLeadInput } from "@/lib/validation/leads";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Postgres unique-violation (SQLSTATE 23505). Drizzle wraps the driver error
 * in a `DrizzleQueryError` whose `.cause` is the actual `NeonDbError` —
 * `.code` lives on `err.cause`, not on `err` itself. Verified live against
 * the real dev DB: `err.code` is `undefined`, `err.cause.code` is `"23505"`.
 */
function isUniqueViolation(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } }).cause;
  return cause?.code === "23505";
}

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

export async function createLeadAction(input: ManualLeadInput): Promise<ActionResult> {
  const parsed = manualLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  try {
    await createLead(scope, parsed.data);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "duplicateEmail" };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function updateLeadAction(leadId: string, input: ManualLeadInput): Promise<ActionResult> {
  const parsed = manualLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  try {
    const updated = await updateLead(scope, leadId, parsed.data);
    if (!updated) {
      return { ok: false, error: "notFound" };
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "duplicateEmail" };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

/** Cancels any outstanding sequence emails before the row (and its
 *  scheduled_emails rows) disappear via cascade delete — otherwise Resend
 *  still sends them with no local record left to explain why. */
export async function deleteLeadAction(leadId: string): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  await cancelSequenceForLead(scope, leadId);
  const deleted = await deleteLead(scope, leadId);
  if (!deleted) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}

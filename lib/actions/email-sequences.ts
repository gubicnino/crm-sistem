"use server";

import { refresh } from "next/cache";
import {
  createEmailSequence,
  SequenceLimitExceededError,
  setEmailSequenceEnabled,
  updateEmailSequence,
} from "@/db/queries/email-sequences";
import { ApplyLimitExceededError, applySequenceToExistingLeads } from "@/lib/email/reapply";
import { requireTrainerOrThrow } from "@/lib/tenant";
import { emailSequenceFormSchema } from "@/lib/validation/email-sequences";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ApplyActionResult =
  | { ok: true; affectedLeads: number; blockedByCancelFailure: number }
  | { ok: false; error: string };

export async function createEmailSequenceAction(input: unknown): Promise<ActionResult> {
  const parsed = emailSequenceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  try {
    await createEmailSequence(scope, parsed.data);
  } catch (err) {
    if (err instanceof SequenceLimitExceededError) {
      return { ok: false, error: "sequenceLimit" };
    }
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function updateEmailSequenceAction(sequenceId: string, input: unknown): Promise<ActionResult> {
  const parsed = emailSequenceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  const updated = await updateEmailSequence(scope, sequenceId, parsed.data);
  if (!updated) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}

export async function setEmailSequenceEnabledAction(sequenceId: string, enabled: boolean): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  const updatedRow = await setEmailSequenceEnabled(scope, sequenceId, enabled);
  if (!updatedRow) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}

/** The trainer's "Uporabi za obstoječe stranke" confirm action — see
 *  lib/email/reapply.ts's applySequenceToExistingLeads for what it does. */
export async function applySequenceToExistingLeadsAction(sequenceId: string): Promise<ApplyActionResult> {
  const scope = await requireTrainerOrThrow();
  try {
    const result = await applySequenceToExistingLeads(scope, sequenceId);
    refresh();
    return { ok: true, affectedLeads: result.affectedLeads, blockedByCancelFailure: result.blockedByCancelFailure };
  } catch (err) {
    if (err instanceof ApplyLimitExceededError) {
      return { ok: false, error: "applyLimitExceeded" };
    }
    throw err;
  }
}

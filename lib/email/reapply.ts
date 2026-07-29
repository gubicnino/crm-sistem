import { addDays } from "date-fns";
import {
  getEmailSequenceWithSteps,
  listLeadsEnrolledInSequence,
  listScheduledEmailsForLeadInSequence,
} from "@/db/queries/email-sequences";
import { getLead } from "@/db/queries/leads";
import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { EmailSequenceStep } from "@/db/schema";
import { cancelScheduledEmailRows } from "@/lib/email/cancel";
import { FROM_EMAIL } from "@/lib/email/client";
import { MAX_APPLY_TO_EXISTING_LEADS_PER_RUN } from "@/lib/email/constants";
import { isTerminalStage } from "@/lib/pipeline";
import { sendReservedStep } from "@/lib/email/schedule";
import type { SequenceRenderContext } from "@/lib/email/variables";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

export class ApplyLimitExceededError extends Error {
  constructor() {
    super(`Applying to more than ${MAX_APPLY_TO_EXISTING_LEADS_PER_RUN} leads at once is not supported.`);
    this.name = "ApplyLimitExceededError";
  }
}

export interface ApplyResult {
  affectedLeads: number;
  scheduledSteps: number;
  skippedPastSteps: number;
}

/**
 * The trainer's "Uporabi za obstoječe stranke" action: re-enrolls every lead
 * already enrolled in this sequence, using its CURRENT steps (after the
 * trainer's edits) instead of whatever was scheduled at the lead's original
 * enrollment time. Anchored to each lead's own original enrollment time
 * (`enrolledAt`), not "now" — a step whose recomputed date has already
 * passed is skipped outright, never sent late. Each step is re-enrolled at
 * `attempt + 1` (per lead, per step) so the unique index on
 * (leadId, sequenceStep, attempt) never collides with the original send —
 * see db/schema.ts's scheduledEmails.attempt doc.
 *
 * Skips a lead entirely if they've unsubscribed or reached a terminal stage
 * since their original enrollment — never resurrect a sequence for someone
 * who opted out or already converted/was lost.
 */
export async function applySequenceToExistingLeads(scope: TrainerScope, sequenceId: string): Promise<ApplyResult> {
  const found = await getEmailSequenceWithSteps(scope, sequenceId);
  if (!found) {
    throw new Error("Sequence not found or not owned by this trainer.");
  }
  const { steps } = found;
  const stepIds = steps.map((step) => step.id);

  const enrolled = await listLeadsEnrolledInSequence(scope, sequenceId);
  if (enrolled.length > MAX_APPLY_TO_EXISTING_LEADS_PER_RUN) {
    throw new ApplyLimitExceededError();
  }

  const trainer = await getTrainer(scope);
  const from = trainer?.fromEmail ?? FROM_EMAIL;
  const trainerName = trainer?.name ?? "";

  const result: ApplyResult = { affectedLeads: 0, scheduledSteps: 0, skippedPastSteps: 0 };
  const now = new Date();

  for (const { leadId, enrolledAt } of enrolled) {
    const lead = await getLead(scope, leadId);
    if (!lead || lead.unsubscribedAt || isTerminalStage(lead.stage)) continue;

    const history = await listScheduledEmailsForLeadInSequence(scope, leadId, stepIds);

    const cancelable = history.filter((row) => row.status === "scheduled" || row.status === "pending");
    if (cancelable.length > 0) {
      await cancelScheduledEmailRows(cancelable);
    }

    // Next attempt per step = 1 + the highest attempt this lead/step pair
    // has ever used (across every status — a sent row's attempt still
    // counts, since the unique index doesn't care about status).
    const maxAttemptByStep = new Map<string, number>();
    for (const row of history) {
      const current = maxAttemptByStep.get(row.sequenceStep) ?? 0;
      if (row.attempt > current) maxAttemptByStep.set(row.sequenceStep, row.attempt);
    }

    const ctx: SequenceRenderContext = { leadName: lead.name, trainerName };
    const link = unsubscribeLink(lead.id);
    let affectedThisLead = false;

    for (const step of steps as EmailSequenceStep[]) {
      const scheduledFor = addDays(enrolledAt, step.dayOffset);
      if (scheduledFor <= now) {
        result.skippedPastSteps++;
        continue;
      }

      const nextAttempt = (maxAttemptByStep.get(step.id) ?? 0) + 1;
      const [reserved] = await reserveScheduledEmails(scope, [
        {
          leadId,
          sequenceStep: step.id,
          stepId: step.id,
          kind: "sequence",
          scheduledFor,
          attempt: nextAttempt,
        },
      ]);
      if (!reserved) continue; // unreachable in practice (nextAttempt is always fresh), but never double-send if it happens

      await sendReservedStep(reserved, step, ctx, link, lead.email, from, scheduledFor.toISOString());
      result.scheduledSteps++;
      affectedThisLead = true;
    }

    if (affectedThisLead) result.affectedLeads++;
  }

  return result;
}

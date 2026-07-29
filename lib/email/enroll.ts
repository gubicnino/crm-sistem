import { addDays } from "date-fns";
import { listEnabledSequencesForLeadCreated } from "@/db/queries/email-sequences";
import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { EmailSequenceStep, Lead } from "@/db/schema";
import { FROM_EMAIL } from "@/lib/email/client";
import { IMMEDIATE_SEND_DELAY_SECONDS } from "@/lib/email/constants";
import { sendReservedStep } from "@/lib/email/schedule";
import type { SequenceRenderContext } from "@/lib/email/variables";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

/**
 * Enrolls a freshly created lead into every one of the trainer's enabled,
 * lead_created-triggered sequences whose triggerSource matches (or is null,
 * meaning "any source"). Replaces the old hardcoded scheduleSequenceForLead
 * — sequences are now trainer data (email_sequences/email_sequence_steps),
 * not code. Still follows the exact reserve->send->commit protocol
 * documented in lib/email/schedule.ts; this function's job is only to
 * decide WHICH steps to reserve.
 *
 * Called from exactly the same two places the old function was:
 * app/api/leads/route.ts's POST handler (on a genuine insert) and the cron
 * reconciler (lib/cron/reconcile.ts).
 */
export async function enrollLeadOnCreate(scope: TrainerScope, lead: Lead): Promise<void> {
  if (lead.unsubscribedAt) return; // never resurrect a sequence for an opted-out lead

  const matches = await listEnabledSequencesForLeadCreated(scope, lead.source);
  if (matches.length === 0) return;

  const trainer = await getTrainer(scope);
  const ctx: SequenceRenderContext = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;
  const link = unsubscribeLink(lead.id);
  const now = new Date();

  for (const { steps } of matches) {
    if (steps.length === 0) continue;

    const reserved = await reserveScheduledEmails(
      scope,
      steps.map((step) => ({
        leadId: lead.id,
        sequenceStep: step.id,
        stepId: step.id,
        kind: "sequence" as const,
        scheduledFor:
          step.dayOffset === 0
            ? new Date(now.getTime() + IMMEDIATE_SEND_DELAY_SECONDS * 1000)
            : addDays(now, step.dayOffset),
      })),
    );
    if (reserved.length === 0) continue; // already enrolled in this sequence — idempotent no-op

    const stepsById = new Map<string, EmailSequenceStep>(steps.map((step) => [step.id, step]));
    for (const row of reserved) {
      const step = stepsById.get(row.sequenceStep);
      if (!step) continue; // unreachable — sequenceStep is always one of `steps`' own ids here
      await sendReservedStep(row, step, ctx, link, lead.email, from, row.scheduledFor.toISOString());
    }
  }
}

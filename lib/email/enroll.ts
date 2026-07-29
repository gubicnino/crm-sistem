import { addDays } from "date-fns";
import { listEnabledSequencesForLeadCreated, listEnabledSequencesForStageEntered } from "@/db/queries/email-sequences";
import { reserveScheduledEmails } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { EmailSequenceStep, Lead, PipelineStage } from "@/db/schema";
import { FROM_EMAIL } from "@/lib/email/client";
import { IMMEDIATE_SEND_DELAY_SECONDS } from "@/lib/email/constants";
import { sendReservedStep } from "@/lib/email/schedule";
import type { SequenceRenderContext } from "@/lib/email/variables";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

/**
 * Reserves and sends one sequence's steps for a lead — the reserve->send->commit
 * protocol documented in lib/email/schedule.ts. Shared by enrollLeadOnCreate
 * and enrollLeadOnStageEntered, which differ only in HOW they select which
 * sequences match; once a sequence is chosen, enrolling into it is identical.
 */
async function scheduleStepsForLead(
  scope: TrainerScope,
  lead: Lead,
  steps: EmailSequenceStep[],
  ctx: SequenceRenderContext,
  from: string,
  unsubLink: string,
): Promise<void> {
  if (steps.length === 0) return;

  const now = new Date();
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
  if (reserved.length === 0) return; // already enrolled in this sequence — idempotent no-op

  const stepsById = new Map<string, EmailSequenceStep>(steps.map((step) => [step.id, step]));
  for (const row of reserved) {
    const step = stepsById.get(row.sequenceStep);
    if (!step) continue; // unreachable — sequenceStep is always one of `steps`' own ids here
    await sendReservedStep(row, step, ctx, unsubLink, lead.email, from, row.scheduledFor.toISOString());
  }
}

/**
 * Enrolls a freshly created lead into every one of the trainer's enabled,
 * lead_created-triggered sequences whose triggerSource matches (or is null,
 * meaning "any source"). Replaces the old hardcoded scheduleSequenceForLead
 * — sequences are now trainer data (email_sequences/email_sequence_steps),
 * not code.
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

  for (const { steps } of matches) {
    await scheduleStepsForLead(scope, lead, steps, ctx, from, link);
  }
}

/**
 * Enrolls a lead into every enabled, stage_entered-triggered sequence whose
 * triggerStage matches the stage it just entered (Phase 3). Called from
 * db/queries/leads.ts's setLeadStage (the only user-driven stage-change
 * path) and createLeadFromIntake's dedup-driven email_lead ->
 * application_received advance — both genuine "entered a stage" events.
 *
 * Never matches a terminal stage in practice: emailSequenceFormSchema
 * rejects a stage_entered trigger targeting client/lost at write time, and
 * neither call site above ever calls this for a terminal transition anyway
 * (those go through cancelSequenceForLead instead — see CLAUDE.md's
 * "Follow-up emails").
 */
export async function enrollLeadOnStageEntered(scope: TrainerScope, lead: Lead, stage: PipelineStage): Promise<void> {
  if (lead.unsubscribedAt) return;

  const matches = await listEnabledSequencesForStageEntered(scope, stage);
  if (matches.length === 0) return;

  const trainer = await getTrainer(scope);
  const ctx: SequenceRenderContext = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;
  const link = unsubscribeLink(lead.id);

  for (const { steps } of matches) {
    await scheduleStepsForLead(scope, lead, steps, ctx, from, link);
  }
}

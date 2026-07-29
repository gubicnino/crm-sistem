import { getEmailSequenceStepForSend } from "@/db/queries/email-sequences";
import { updateScheduledEmail } from "@/db/queries/scheduled-emails";
import { getTrainer } from "@/db/queries/trainers";
import type { Lead, ScheduledEmail } from "@/db/schema";
import { resend, FROM_EMAIL } from "@/lib/email/client";
import { renderSequenceStep, type RenderableStep } from "@/lib/email/render";
import type { SequenceRenderContext } from "@/lib/email/variables";
import type { TrainerScope } from "@/lib/tenant";
import { unsubscribeLink } from "@/lib/unsubscribe";

/**
 * Sends one reserved row to Resend and commits the result. Never throws —
 * a send failure leaves the row `pending` with `lastError` set, for the
 * cron reconciler to retry (using this same function) rather than losing
 * the attempt. Exported (was module-private) so lib/email/enroll.ts's
 * enrollLeadOnCreate can share it — the send/commit contract is unchanged;
 * only the step parameter's shape changed, from the old hardcoded
 * SequenceStep to any RenderableStep (email_sequence_steps rows satisfy
 * this structurally).
 */
export async function sendReservedStep(
  row: ScheduledEmail,
  step: RenderableStep,
  ctx: SequenceRenderContext,
  unsubLink: string,
  to: string,
  from: string,
  scheduledAt?: string,
): Promise<void> {
  const { subject, react } = renderSequenceStep(step, ctx, unsubLink);

  try {
    // Our own row id as the idempotency key: a retry of a send whose response
    // we lost (crash, timeout) returns the SAME Resend email id — the cancel
    // handle is recoverable rather than lost forever.
    const { data, error } = await resend.emails.send(
      { from, to, subject, react, scheduledAt },
      { idempotencyKey: row.id },
    );

    if (error) {
      await updateScheduledEmail(row.id, { lastError: `${error.name}: ${error.message}` });
      return;
    }

    await updateScheduledEmail(row.id, { resendEmailId: data!.id, status: "scheduled" });
  } catch (err) {
    // Defensive: Resend's SDK documents { error } rather than throwing, but
    // an unexpected network-level throw must still not abort a caller's loop.
    const message = err instanceof Error ? err.message : String(err);
    await updateScheduledEmail(row.id, { lastError: message });
  }
}

/**
 * Retries a `pending` row within the reconciler's safe retry window (see
 * lib/email/constants.ts and db/queries/scheduled-emails.ts's
 * listRetryablePendingScheduledEmails). Sends immediately rather than
 * reusing the original (now-past) scheduledFor — see the original doc for
 * why. Uses the same idempotencyKey, so if the original request actually
 * did land, this call safely returns the same Resend email id instead of
 * sending a duplicate.
 *
 * A row with no stepId is a legacy row from before this migration — there is
 * nothing to retry against, so it's left alone (surfaced by the digest via
 * its existing orphaned-row handling, not retried here).
 */
export async function retryPendingScheduledEmail(scope: TrainerScope, row: ScheduledEmail, lead: Lead): Promise<void> {
  if (!row.stepId) return;
  const step = await getEmailSequenceStepForSend(scope, row.stepId);
  if (!step) return; // the step (or its whole sequence) was deleted since this row was reserved

  const trainer = await getTrainer(scope);
  const link = unsubscribeLink(lead.id);
  const ctx: SequenceRenderContext = { leadName: lead.name, trainerName: trainer?.name ?? "" };
  const from = trainer?.fromEmail ?? FROM_EMAIL;

  await sendReservedStep(row, step, ctx, link, lead.email, from);
}

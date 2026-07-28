import {
  listCancelableScheduledEmails,
  listCancelableScheduledEmailsForTrainer,
  updateScheduledEmail,
  updateScheduledEmailIfStatus,
} from "@/db/queries/scheduled-emails";
import type { ScheduledEmail } from "@/db/schema";
import { resend } from "@/lib/email/client";
import type { TrainerScope } from "@/lib/tenant";

export interface CancelSequenceResult {
  canceled: number;
  alreadySent: number;
  failed: number;
}

/**
 * Cancels one row against Resend and commits the result. Shared by
 * cancelSequenceForLead and cancelAllSequencesForTrainer so both go through
 * identical, once-verified handling of Resend's cancel semantics. Never call
 * this in parallel across rows — see the sequential loops in both callers;
 * one row's failure must not swallow or block the rest.
 */
async function cancelRow(row: ScheduledEmail, result: CancelSequenceResult): Promise<void> {
  if (!row.resendEmailId) {
    // Never actually sent to Resend yet (still in the reserve/pending
    // window) — nothing to cancel there, just close it out here.
    await updateScheduledEmail(row.id, { status: "canceled", canceledAt: new Date() });
    result.canceled++;
    return;
  }

  const { error } = await resend.emails.cancel(row.resendEmailId);

  if (!error) {
    const transitioned = await updateScheduledEmailIfStatus(row.id, "scheduled", {
      status: "canceled",
      canceledAt: new Date(),
    });
    if (transitioned) result.canceled++;
    return;
  }

  // Verified live against real Resend calls (see the phase summary):
  // - An already-SENT email returns 422 validation_error, "Email is not
  //   scheduled" — THIS is the reliable "already sent" signal.
  // - `not_found` is NOT reliable for that purpose: canceling an email
  //   within ~1s of scheduling it returned 404 not_found even though the
  //   email was genuinely still pending and cancelable moments later
  //   (confirmed by retrying the same id, which then succeeded). Treating
  //   `not_found` as "already sent" would risk marking a still-pending,
  //   still-outstanding email as `sent` and abandoning it — Resend would
  //   then deliver it on schedule, uncanceled. So `not_found` falls through
  //   to `cancel_failed` below, for the Phase 6 reconciler to retry.
  if (error.name === "validation_error" && /not scheduled/i.test(error.message)) {
    await updateScheduledEmail(row.id, { status: "sent", sentAt: new Date() });
    result.alreadySent++;
    return;
  }

  // Any other error (including not_found — see above): record it and flag
  // for the reconciler, but never throw — one row's failure must not abort
  // the rest of the loop.
  await updateScheduledEmail(row.id, {
    status: "cancel_failed",
    lastError: `${error.name}: ${error.message}`,
  });
  result.failed++;
}

/**
 * Cancels every outstanding (scheduled or pending) email for a lead. Called
 * from exactly the CLAUDE.md-mandated trigger points:
 *   - db/queries/leads.ts's setLeadStage(), when moving to `client` or `lost`
 *   - the public /unsubscribe/[token] page
 *   - the trainer's manual "stop sequence" action (Phase 5)
 * Never call resend.emails.cancel() in parallel — see cancelRow's doc.
 */
export async function cancelSequenceForLead(scope: TrainerScope, leadId: string): Promise<CancelSequenceResult> {
  const rows = await listCancelableScheduledEmails(scope, leadId);
  const result: CancelSequenceResult = { canceled: 0, alreadySent: 0, failed: 0 };
  for (const row of rows) {
    await cancelRow(row, result);
  }
  return result;
}

/**
 * Cancels every outstanding email across an ENTIRE trainer, not just one
 * lead. The mandatory first step of deactivating a trainer
 * (lib/actions/admin.ts's deactivateTrainerAction) — per CLAUDE.md, a hard
 * delete or a bare deactivation flag without this would strand up to 30 days
 * of Resend-scheduled sends with no way to cancel them.
 */
export async function cancelAllSequencesForTrainer(scope: TrainerScope): Promise<CancelSequenceResult> {
  const rows = await listCancelableScheduledEmailsForTrainer(scope);
  const result: CancelSequenceResult = { canceled: 0, alreadySent: 0, failed: 0 };
  for (const row of rows) {
    await cancelRow(row, result);
  }
  return result;
}

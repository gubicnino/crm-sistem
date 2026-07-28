import {
  listCancelableScheduledEmails,
  updateScheduledEmail,
  updateScheduledEmailIfStatus,
} from "@/db/queries/scheduled-emails";
import { resend } from "@/lib/email/client";
import type { TrainerScope } from "@/lib/tenant";

export interface CancelSequenceResult {
  canceled: number;
  alreadySent: number;
  failed: number;
}

/**
 * Cancels every outstanding (scheduled or pending) email for a lead. Called
 * from exactly the CLAUDE.md-mandated trigger points:
 *   - db/queries/leads.ts's setLeadStage(), when moving to `client` or `lost`
 *   - the public /unsubscribe/[token] page
 *   - the trainer's manual "stop sequence" action (Phase 5)
 * Never call resend.emails.cancel() in parallel — see the sequential loop
 * below; one row's failure must not swallow or block the rest.
 */
export async function cancelSequenceForLead(scope: TrainerScope, leadId: string): Promise<CancelSequenceResult> {
  const rows = await listCancelableScheduledEmails(scope, leadId);
  const result: CancelSequenceResult = { canceled: 0, alreadySent: 0, failed: 0 };

  for (const row of rows) {
    if (!row.resendEmailId) {
      // Never actually sent to Resend yet (still in the reserve/pending
      // window) — nothing to cancel there, just close it out here.
      await updateScheduledEmail(row.id, { status: "canceled", canceledAt: new Date() });
      result.canceled++;
      continue;
    }

    const { error } = await resend.emails.cancel(row.resendEmailId);

    if (!error) {
      const transitioned = await updateScheduledEmailIfStatus(row.id, "scheduled", {
        status: "canceled",
        canceledAt: new Date(),
      });
      if (transitioned) result.canceled++;
      continue;
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
      continue;
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

  return result;
}

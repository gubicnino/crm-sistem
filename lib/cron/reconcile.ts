import { getLeadByIdUnscoped, listLeadsMissingScheduledEmails } from "@/db/queries/leads";
import {
  listRetryablePendingScheduledEmails,
  markOrphanedPendingScheduledEmails,
} from "@/db/queries/scheduled-emails";
import { retryPendingScheduledEmail, scheduleSequenceForLead } from "@/lib/email/schedule";
import { MAX_RECONCILE_LEADS_PER_RUN, MAX_RECONCILE_SENDS_PER_RUN } from "@/lib/cron/limits";
import { systemScope } from "@/lib/tenant";
import { isTerminalStage } from "@/lib/pipeline";

export interface ReconcileStats {
  reconciledLeads: number;
  reconciledSends: number;
  orphanedEmails: number;
  bailedLeads: boolean;
  bailedSends: boolean;
}

const RECONCILE_LOOKBACK_DAYS = 7;

/**
 * Two independent jobs, both safe to call blindly thanks to Phase 4's design:
 *  - leads with zero scheduled_emails rows (e.g. Resend/DB was down at
 *    creation time) get scheduleSequenceForLead() — a no-op if rows already
 *    exist, via the (leadId, sequenceStep) unique index.
 *  - `pending` rows aged into the safe retry window get retried with the
 *    same idempotency key; older rows are marked `orphaned` and never
 *    retried (see lib/email/constants.ts for why).
 * Each half has its own cap; exceeding it bails that half rather than
 * silently truncating (CLAUDE.md: "that signals a bug, not real growth").
 */
export async function reconcile(): Promise<ReconcileStats> {
  const stats: ReconcileStats = {
    reconciledLeads: 0,
    reconciledSends: 0,
    orphanedEmails: 0,
    bailedLeads: false,
    bailedSends: false,
  };

  const missingLeads = await listLeadsMissingScheduledEmails(
    RECONCILE_LOOKBACK_DAYS,
    MAX_RECONCILE_LEADS_PER_RUN + 1,
  );
  if (missingLeads.length > MAX_RECONCILE_LEADS_PER_RUN) {
    console.error(`[cron] reconcile: ${missingLeads.length} leads missing sequences exceeds cap, bailing`);
    stats.bailedLeads = true;
  } else {
    for (const lead of missingLeads) {
      const scope = systemScope(lead.trainerId, "cron_daily");
      await scheduleSequenceForLead(scope, lead);
      stats.reconciledLeads++;
    }
  }

  const retryable = await listRetryablePendingScheduledEmails(MAX_RECONCILE_SENDS_PER_RUN + 1);
  if (retryable.length > MAX_RECONCILE_SENDS_PER_RUN) {
    console.error(`[cron] reconcile: ${retryable.length} retryable sends exceeds cap, bailing`);
    stats.bailedSends = true;
  } else {
    for (const row of retryable) {
      const lead = await getLeadByIdUnscoped(row.leadId);
      // Skip if the lead vanished, unsubscribed, or already reached a
      // terminal stage since this row was reserved — never resurrect a
      // sequence for someone who opted out or already converted/was lost.
      if (!lead || lead.unsubscribedAt || isTerminalStage(lead.stage)) continue;
      const scope = systemScope(lead.trainerId, "cron_daily");
      await retryPendingScheduledEmail(scope, row, lead);
      stats.reconciledSends++;
    }
  }

  stats.orphanedEmails = await markOrphanedPendingScheduledEmails();

  return stats;
}

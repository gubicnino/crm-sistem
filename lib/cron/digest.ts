import { listLeads } from "@/db/queries/leads";
import { countScheduledEmailsByStatus } from "@/db/queries/scheduled-emails";
import { listTrainersWithDigestEnabled } from "@/db/queries/trainers";
import { resend, FROM_EMAIL } from "@/lib/email/client";
import { DailyDigestEmail } from "@/lib/email/templates/daily-digest";
import { MAX_DIGESTS_PER_RUN } from "@/lib/cron/limits";
import { findStuckLeads } from "@/lib/cron/stuck-leads";
import { systemScope } from "@/lib/tenant";

export interface DigestStats {
  sent: number;
  bailed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One email per trainer with digestEnabled, summarizing new leads, stuck
 * leads, and operational warnings (orphaned/cancel-failed emails) — the
 * digest doubles as this system's only alerting channel. Skipped entirely
 * when there's nothing to report; never a zero-content email.
 */
export async function sendDailyDigests(): Promise<DigestStats> {
  const trainers = await listTrainersWithDigestEnabled();

  if (trainers.length > MAX_DIGESTS_PER_RUN) {
    console.error(`[cron] digest: ${trainers.length} trainers exceeds MAX_DIGESTS_PER_RUN, bailing`);
    return { sent: 0, bailed: true };
  }

  let sent = 0;
  const now = Date.now();

  for (const trainer of trainers) {
    const scope = systemScope(trainer.id, "cron_daily");
    const allLeads = await listLeads(scope);

    const newLeads = allLeads.filter((lead) => now - lead.createdAt.getTime() < DAY_MS);
    const stuckLeads = findStuckLeads(allLeads, now);
    const orphanedCount = await countScheduledEmailsByStatus(scope, ["orphaned"]);
    const cancelFailedCount = await countScheduledEmailsByStatus(scope, ["cancel_failed"]);

    if (newLeads.length === 0 && stuckLeads.length === 0 && orphanedCount === 0 && cancelFailedCount === 0) {
      continue;
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: trainer.email,
      subject: "Dnevni pregled — Trener Growth Sistem",
      react: DailyDigestEmail({
        trainerName: trainer.name,
        newLeadsCount: newLeads.length,
        stuckLeadsCount: stuckLeads.length,
        orphanedCount,
        cancelFailedCount,
      }),
    });

    if (error) {
      console.error(`[cron] digest send failed for trainer ${trainer.id}:`, error);
      continue;
    }
    sent++;
  }

  return { sent, bailed: false };
}

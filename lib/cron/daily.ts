import { cleanupExpiredRows, finishCronRun, startCronRunIfNotAlreadyRun } from "@/db/queries/cron";
import type { CronRunStats } from "@/db/types";
import { sendDailyDigests } from "@/lib/cron/digest";
import { reconcile } from "@/lib/cron/reconcile";

export interface DailyCronResult {
  skipped?: "already_ran_today";
  stats?: CronRunStats;
}

/** UTC calendar day, per CLAUDE.md's hobby-plan constraint: once/day, fires
 *  anywhere within the scheduled hour, UTC only — never local-timezone logic. */
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function runDailyCron(): Promise<DailyCronResult> {
  const runDate = todayUtc();

  const started = await startCronRunIfNotAlreadyRun(runDate);
  if (!started) {
    return { skipped: "already_ran_today" };
  }

  const stats: CronRunStats = {};

  try {
    const reconcileStats = await reconcile();
    stats.reconciledLeads = reconcileStats.reconciledLeads;
    stats.reconciledSends = reconcileStats.reconciledSends;
    stats.orphanedEmails = reconcileStats.orphanedEmails;
    stats.bailedTasks = [
      ...(reconcileStats.bailedLeads ? ["reconcile_leads"] : []),
      ...(reconcileStats.bailedSends ? ["reconcile_sends"] : []),
    ];

    const digestStats = await sendDailyDigests();
    stats.digestsSent = digestStats.sent;
    if (digestStats.bailed) stats.bailedTasks.push("digest");

    await cleanupExpiredRows();

    await finishCronRun(runDate, "completed", stats);
    return { stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stats.errors = [...(stats.errors ?? []), message];
    await finishCronRun(runDate, "failed", stats);
    throw err;
  }
}

import type { Lead } from "@/db/schema";
import { isStuck, isTerminalStage } from "@/lib/pipeline";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Computed, not stored — changing a threshold in lib/pipeline.ts needs no
 *  backfill. Used by both the digest and (potentially) future dashboard UI. */
export function findStuckLeads(leads: Lead[], now: number = Date.now()): Lead[] {
  return leads.filter((lead) => {
    if (isTerminalStage(lead.stage)) return false;
    const daysInStage = (now - lead.stageChangedAt.getTime()) / DAY_MS;
    return isStuck(lead.stage, daysInStage);
  });
}

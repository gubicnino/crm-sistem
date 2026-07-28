/**
 * Caps for the daily cron. Exceeding any of these signals a bug, not real
 * growth (see CLAUDE.md's "Security requirements" / cron section) — the
 * corresponding task bails and logs rather than silently truncating.
 */
export const MAX_DIGESTS_PER_RUN = 200;
export const MAX_RECONCILE_LEADS_PER_RUN = 50;
export const MAX_RECONCILE_SENDS_PER_RUN = 200;

/** Per-stage stuck thresholds live in lib/pipeline.ts, shared with the
 *  Phase 5 analytics stuck-count so the two never drift apart. */
export { STUCK_THRESHOLD_DAYS, isStuck } from "@/lib/pipeline";

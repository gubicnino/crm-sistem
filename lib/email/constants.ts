/** Resend's hard ceiling on scheduledAt — see CLAUDE.md's "Follow-up emails". */
export const MAX_SCHEDULE_DAYS = 30;

/**
 * Resend idempotency keys are honored for ~24h. The reconciler (Phase 6) must
 * never retry a pending row older than this — past the window, a retry risks
 * a double-send with no way to know whether the original request landed.
 */
export const IDEMPOTENCY_KEY_TTL_HOURS = 24;

/** Lower bound before the reconciler retries a pending row — gives the
 *  original request room to land (network hiccups, Resend-side delay) before
 *  it's treated as stuck. */
export const RECONCILE_RETRY_MIN_MINUTES = 15;

/** Upper bound: pending rows older than this are marked `orphaned` and never
 *  retried, leaving margin before the 24h idempotency-key TTL actually expires. */
export const RECONCILE_RETRY_MAX_HOURS = 20;

/** Day-0 steps send `now + this` rather than immediately — one uniform
 *  scheduled-send code path, and a real (if brief) cancellation window even
 *  for the instant confirmation email. */
export const IMMEDIATE_SEND_DELAY_SECONDS = 60;

/** Product cap, not a technical one — keeps the sequence list scannable and
 *  bounds how many Resend schedule calls one lead enrollment can fan out
 *  into. Enforced in db/queries/email-sequences.ts's createEmailSequence. */
export const MAX_SEQUENCES_PER_TRAINER = 5;

/** Same rationale as MAX_SEQUENCES_PER_TRAINER, per sequence. */
export const MAX_STEPS_PER_SEQUENCE = 15;

/**
 * Phase 4's "apply to existing leads" cap. Exceeding it bails with an error
 * rather than silently processing a truncated subset — same reasoning as
 * lib/cron/limits.ts's caps (CLAUDE.md: "that signals a bug, not real
 * growth"). A trainer with more enrolled leads than this needs to be told
 * to ask, not have their re-enrollment quietly do less than they asked for.
 */
export const MAX_APPLY_TO_EXISTING_LEADS_PER_RUN = 200;

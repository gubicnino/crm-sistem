import { incrementRateLimitCounter } from "@/db/queries/rate-limit";

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window counter keyed by an arbitrary bucket string. Fails OPEN on a DB
 * error — an outage of this table must not block registration, password
 * reset, or (Phase 3) public lead ingest.
 */
export async function checkRateLimit(bucket: string, config: RateLimitConfig): Promise<boolean> {
  const windowMs = config.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  try {
    const count = await incrementRateLimitCounter(bucket, windowStart);
    return count <= config.limit;
  } catch (err) {
    console.error("[rate-limit] check failed, failing open:", err);
    return true;
  }
}

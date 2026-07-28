import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

/**
 * One atomic upsert per call — no read-then-write race. See lib/rate-limit.ts
 * for bucket naming and default limits built on top of this.
 */
export async function incrementRateLimitCounter(bucket: string, windowStart: Date): Promise<number> {
  const [row] = await db
    .insert(rateLimit)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimit.bucket, rateLimit.windowStart],
      set: { count: sql`${rateLimit.count} + 1` },
    })
    .returning({ count: rateLimit.count });
  return row.count;
}

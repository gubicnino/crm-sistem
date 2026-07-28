import { timingSafeEqual } from "node:crypto";
import { runDailyCron } from "@/lib/cron/daily";

export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset secret must never be treated as "no auth required".
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (!header) return false;

  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  // timingSafeEqual throws on mismatched lengths, so guard that first —
  // still safe, since length alone doesn't leak the secret's content.
  if (headerBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(headerBuf, expectedBuf);
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
 *  the env var is set (see vercel.json). Runs once per UTC calendar day —
 *  see lib/cron/daily.ts's idempotency primitive for why a second trigger
 *  the same day is a safe no-op rather than a double-run. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyCron();
    return Response.json(result);
  } catch (err) {
    console.error("[cron] daily run failed:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

/**
 * Best-effort client IP from standard proxy headers (Vercel sets
 * x-forwarded-for). Used only for rate-limit bucketing, never for
 * authorization decisions — NextRequest.ip/.geo were removed upstream, so
 * this is the current way to get it.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}

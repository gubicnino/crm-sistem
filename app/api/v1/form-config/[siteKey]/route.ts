import { getTrainerBySiteKey } from "@/db/queries/trainers";
import { corsHeaders, preflight } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

/**
 * Public, CORS-open. Returns ONLY the trainer's applicationQuestions — nothing
 * else about the trainer. This is the resolution to CLAUDE.md's internal
 * contradiction (the external site "fetches this config" vs. "site_key must
 * never grant read access to anything"): site_key grants read access to
 * nothing beyond the public form definition, which is already rendered on the
 * trainer's public page.
 */
export function OPTIONS() {
  return preflight("GET");
}

export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  const headers = { ...corsHeaders("GET"), "Cache-Control": "public, max-age=300" };
  const { siteKey } = await params;

  const ip = getClientIp(request);
  const ipOk = await checkRateLimit(`form_config:ip:${ip}`, { limit: 60, windowSeconds: 600 });
  if (!ipOk) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...headers, "Retry-After": "600" } },
    );
  }

  const trainer = await getTrainerBySiteKey(siteKey);
  if (!trainer) {
    // Same anti-enumeration posture as /api/leads: 200 with an empty result,
    // not 404 — a 404 would make this a site_key validity oracle.
    return Response.json({ questions: [] }, { headers });
  }

  return Response.json({ questions: trainer.applicationQuestions }, { headers });
}

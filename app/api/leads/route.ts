import { createLeadFromIntake } from "@/db/queries/leads";
import { getTrainerBySiteKey } from "@/db/queries/trainers";
import type { PipelineStage } from "@/db/schema";
import { corsHeaders, preflight } from "@/lib/cors";
import { scheduleSequenceForLead } from "@/lib/email/schedule";
import { logLeadIntake, logLeadIntakeError } from "@/lib/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { systemScope } from "@/lib/tenant";
import { leadIntakeSchema } from "@/lib/validation/lead-intake";

// No Content-Length header (e.g. chunked transfer) skips this guard — accepted
// tradeoff for v1; a byte-counting stream reader would close the gap.
const MAX_BODY_BYTES = 100_000;

const STAGE_FOR_SOURCE: Record<"application" | "lead_magnet", PipelineStage> = {
  application: "application_received",
  lead_magnet: "email_lead",
};

export function OPTIONS() {
  return preflight("POST");
}

/**
 * Public, CORS-open lead ingest. Zero trust on input — see CLAUDE.md's trust
 * boundary table. Step order below is deliberate; see each comment before
 * reordering anything.
 */
export async function POST(request: Request) {
  const headers = corsHeaders("POST");

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers });
  }

  // Rate limit by IP FIRST, before any site_key lookup — otherwise the lookup
  // itself becomes an enumeration oracle for an unlimited number of guesses.
  const ip = getClientIp(request);
  const ipOk = await checkRateLimit(`leads:ip:${ip}`, { limit: 20, windowSeconds: 600 });
  if (!ipOk) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...headers, "Retry-After": "600" } },
    );
  }

  const parsed = leadIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", fields: parsed.error.issues.map((issue) => issue.path.join(".")) },
      { status: 400, headers },
    );
  }
  const input = parsed.data;

  // Honeypot: accept-and-discard, indistinguishable from a real success.
  if (input.website) {
    logLeadIntake({ source: input.source, outcome: "honeypot" });
    return Response.json({ ok: true }, { headers });
  }

  const trainer = await getTrainerBySiteKey(input.siteKey);
  if (!trainer) {
    // Also 200, not 404 — a 404 would turn this into a site_key validity
    // oracle. Logged server-side so an operator can still notice abuse.
    logLeadIntake({ source: input.source, outcome: "unknown_site_key" });
    return Response.json({ ok: true }, { headers });
  }

  const siteKeyOk = await checkRateLimit(`leads:site:${input.siteKey}`, { limit: 100, windowSeconds: 3600 });
  if (!siteKeyOk) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...headers, "Retry-After": "3600" } },
    );
  }

  const scope = systemScope(trainer.id, "site_key_ingest");

  try {
    const { lead, isNew } = await createLeadFromIntake(scope, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      stage: STAGE_FOR_SOURCE[input.source],
      answers: input.answers,
    });

    if (isNew) {
      // Never let an email failure fail this request — the lead is already
      // saved. scheduleSequenceForLead itself never throws (see its internals);
      // this catch is defense in depth against something unexpected upstream.
      try {
        await scheduleSequenceForLead(scope, lead);
      } catch (err) {
        logLeadIntakeError("scheduleSequenceForLead", err);
      }
    }

    logLeadIntake({
      trainerId: trainer.id,
      leadId: lead.id,
      source: input.source,
      outcome: isNew ? "created" : "updated",
    });
    return Response.json({ ok: true }, { headers });
  } catch (err) {
    logLeadIntakeError("createLeadFromIntake", err);
    return Response.json({ error: "internal_error" }, { status: 500, headers });
  }
}

/**
 * Structured logging for the public ingest path. Never logs full lead
 * payloads (name, email, phone, answers) per CLAUDE.md's security
 * requirements — only identifiers and outcomes.
 */
export function logLeadIntake(event: {
  trainerId?: string;
  leadId?: string;
  source?: string;
  outcome: string;
}): void {
  console.log("[leads-intake]", JSON.stringify(event));
}

/** Logs err.message, never the request body — the easy accidental violation
 *  of the "no PII in logs" rule is a catch block that logs its input. */
export function logLeadIntakeError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[leads-intake]", context, message);
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless HMAC-SHA256 of leadId, keyed by AUTH_SECRET. No DB lookup needed
 * to validate, no extra schema column, and revocable by rotating the secret.
 */
function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set.");
  return value;
}

function sign(leadId: string): Buffer {
  return createHmac("sha256", secret()).update(leadId).digest();
}

export function mintUnsubscribeToken(leadId: string): string {
  const leadIdPart = Buffer.from(leadId, "utf8").toString("base64url");
  const sigPart = sign(leadId).toString("base64url");
  return `${leadIdPart}.${sigPart}`;
}

/** Returns the leadId iff the token's signature is valid; null otherwise. */
export function verifyUnsubscribeToken(token: string): string | null {
  const [leadIdPart, sigPart] = token.split(".");
  if (!leadIdPart || !sigPart) return null;

  let leadId: string;
  try {
    leadId = Buffer.from(leadIdPart, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(leadId);
  const actual = Buffer.from(sigPart, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return leadId;
}

export function unsubscribeLink(leadId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/unsubscribe/${mintUnsubscribeToken(leadId)}`;
}

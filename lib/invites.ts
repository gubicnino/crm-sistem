import { createHash, randomBytes } from "node:crypto";
import { createInvite, getInviteByTokenHash } from "@/db/queries/invites";
import type { Invite } from "@/db/schema";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintInvite(email: string): Promise<{ invite: Invite; rawToken: string }> {
  const rawToken = randomBytes(32).toString("hex");
  const invite = await createInvite({
    email,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return { invite, rawToken };
}

/** Null for any invalid reason (not found, expired, already used) — deliberately
 *  not distinguished, same principle as password-reset token consumption. */
export async function verifyInviteToken(rawToken: string): Promise<Invite | null> {
  const invite = await getInviteByTokenHash(hashToken(rawToken));
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return null;
  }
  return invite;
}

export function inviteLink(rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/register/${rawToken}`;
}

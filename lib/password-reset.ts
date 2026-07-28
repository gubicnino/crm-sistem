import { createHash, randomBytes } from "node:crypto";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  invalidateOtherPasswordResetTokens,
} from "@/db/queries/password-reset";

const RESET_TTL_MS = 60 * 60 * 1000; // 60 minutes

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function mintPasswordResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await createPasswordResetToken({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  return rawToken;
}

/** Null for any invalid reason (not found, expired, already used) — deliberately
 *  indistinguishable to the caller. On success, invalidates the user's other
 *  outstanding tokens. */
export async function redeemPasswordResetToken(rawToken: string): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const userId = await consumePasswordResetToken(tokenHash);
  if (userId) {
    await invalidateOtherPasswordResetTokens(userId, tokenHash);
  }
  return userId;
}

export function passwordResetLink(rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/reset-password/${rawToken}`;
}

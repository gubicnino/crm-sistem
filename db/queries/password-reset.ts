import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens } from "@/db/schema";

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function createPasswordResetToken(input: CreatePasswordResetTokenInput): Promise<void> {
  await db.insert(passwordResetTokens).values(input);
}

/**
 * Atomic consume: returns the userId iff the token was valid, unexpired, and
 * unused, in one statement (no read-then-write race). An empty result means
 * invalid/expired/used — deliberately indistinguishable to the caller.
 */
export async function consumePasswordResetToken(tokenHash: string): Promise<string | null> {
  const now = new Date();
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });
  return row?.userId ?? null;
}

/** Invalidate a user's other outstanding reset tokens after a successful reset. */
export async function invalidateOtherPasswordResetTokens(userId: string, exceptTokenHash: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
        ne(passwordResetTokens.tokenHash, exceptTokenHash),
      ),
    );
}

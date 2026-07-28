import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invites, type Invite } from "@/db/schema";

export interface CreateInviteInput {
  email: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function createInvite(input: CreateInviteInput): Promise<Invite> {
  const [invite] = await db.insert(invites).values(input).returning();
  return invite;
}

export async function getInviteByTokenHash(tokenHash: string): Promise<Invite | null> {
  const [invite] = await db.select().from(invites).where(eq(invites.tokenHash, tokenHash)).limit(1);
  return invite ?? null;
}

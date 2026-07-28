import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invites, trainers, users, type User } from "@/db/schema";
import type { UserRole } from "@/db/types";

/**
 * Unscoped by necessity: this is how a login attempt resolves a user, before any
 * TrainerScope can exist. Used only by lib/auth.ts's authorize() callback.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export interface LoginIdentity {
  role: UserRole;
  trainerId: string | null;
  trainerDeactivatedAt: Date | null;
}

/**
 * Unscoped by necessity: resolves who a just-authenticated user IS. This is
 * the ONLY source of `role` in the whole app — lib/auth.ts's jwt callback
 * must take it from here (on sign-in only) and NEVER from a client-supplied
 * session-update payload — see lib/impersonation.ts's header comment for why
 * that distinction is load-bearing security, not style.
 */
export async function getLoginIdentity(userId: string): Promise<LoginIdentity | null> {
  const [row] = await db
    .select({
      role: users.role,
      trainerId: trainers.id,
      trainerDeactivatedAt: trainers.deactivatedAt,
    })
    .from(users)
    .leftJoin(trainers, eq(trainers.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export interface CreateUserAndTrainerInput {
  email: string;
  passwordHash: string;
  name: string;
  siteKey: string;
  inviteId: string;
}

/**
 * Invite redemption: creates the user + trainer pair and marks the invite used
 * as a single db.batch (one transaction over HTTP — see db/index.ts). The user
 * id is generated client-side up front so both inserts can reference it within
 * the same batch — $defaultFn on users.id only resolves inside its own insert
 * call, not across statements.
 */
export async function createUserAndTrainer(input: CreateUserAndTrainerInput) {
  const userId = crypto.randomUUID();
  const results = await db.batch([
    db
      .insert(users)
      .values({ id: userId, email: input.email, passwordHash: input.passwordHash })
      .returning(),
    db
      .insert(trainers)
      .values({ userId, name: input.name, email: input.email, siteKey: input.siteKey })
      .returning(),
    db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, input.inviteId)),
  ]);

  return { user: results[0][0], trainer: results[1][0] };
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

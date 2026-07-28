import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { trainers, users, type Trainer, type User } from "@/db/schema";

/**
 * Cross-tenant by necessity: the operator console lists every trainer. Callers
 * MUST gate on requireAdmin()/requireAdminOrThrow() (lib/tenant.ts) first —
 * nothing in this function checks who is asking.
 */
export async function listAllTrainers(): Promise<Trainer[]> {
  return db.select().from(trainers).orderBy(trainers.createdAt);
}

/**
 * Unscoped by necessity: lib/auth.ts's jwt callback calls this to verify an
 * impersonation target BEFORE writing it into the signed token — see
 * lib/impersonation.ts. Existence + active only; deliberately returns a
 * boolean and never a row, so it can't leak anything to a probing caller.
 */
export async function isImpersonableTrainer(trainerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: trainers.id })
    .from(trainers)
    .where(and(eq(trainers.id, trainerId), isNull(trainers.deactivatedAt)))
    .limit(1);
  return row !== undefined;
}

/**
 * Unscoped by necessity: the operator console flips a trainer's active state;
 * trainers.id IS the handle here and there is no tenant to scope by. Pass
 * `null` to reactivate. Callers MUST gate on requireAdminOrThrow() first.
 */
export async function setTrainerDeactivated(trainerId: string, at: Date | null): Promise<Trainer | null> {
  const [updated] = await db
    .update(trainers)
    .set({ deactivatedAt: at })
    .where(eq(trainers.id, trainerId))
    .returning();
  return updated ?? null;
}

export interface CreateAdminUserInput {
  email: string;
  name: string | null;
  passwordHash: string;
}

/**
 * Unscoped by necessity: scripts/create-admin.ts runs from a terminal with no
 * session. Creates a users row with role "admin" and deliberately NO trainers
 * row — an admin has no tenant of their own, only borrowed ones via
 * impersonation (see lib/impersonation.ts).
 */
export async function createAdminUser(input: CreateAdminUserInput): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash: input.passwordHash, role: "admin" })
    .returning();
  return user;
}

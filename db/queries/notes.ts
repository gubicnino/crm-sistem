import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, notes, type Note } from "@/db/schema";
import { scoped, type TrainerScope } from "@/lib/tenant";

export async function listNotes(scope: TrainerScope, leadId: string): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(scoped(notes, scope, eq(notes.leadId, leadId)))
    .orderBy(notes.createdAt);
}

/** Returns null if leadId doesn't exist or belongs to another trainer — notes.leadId
 *  has no DB-level FK back to notes.trainerId, so ownership must be checked here. */
export async function createNote(scope: TrainerScope, leadId: string, body: string): Promise<Note | null> {
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(scoped(leads, scope, eq(leads.id, leadId)))
    .limit(1);
  if (!lead) {
    return null;
  }

  const [note] = await db
    .insert(notes)
    .values({ trainerId: scope.trainerId, leadId, body })
    .returning();
  return note;
}

/** Returns whether a row was actually deleted (false if it didn't exist or
 *  belonged to another trainer — ownedBy makes cross-tenant deletion impossible). */
export async function deleteNote(scope: TrainerScope, noteId: string): Promise<boolean> {
  const rows = await db
    .delete(notes)
    .where(scoped(notes, scope, eq(notes.id, noteId)))
    .returning();
  return rows.length > 0;
}

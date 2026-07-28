import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, type Note } from "@/db/schema";
import { scoped, type TrainerScope } from "@/lib/tenant";

export async function listNotes(scope: TrainerScope, leadId: string): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(scoped(notes, scope, eq(notes.leadId, leadId)))
    .orderBy(notes.createdAt);
}

export async function createNote(scope: TrainerScope, leadId: string, body: string): Promise<Note> {
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

"use server";

import { refresh } from "next/cache";
import { createNote, deleteNote } from "@/db/queries/notes";
import { requireTrainerOrThrow } from "@/lib/tenant";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_NOTE_LENGTH = 4000;

export async function createNoteAction(leadId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  const note = await createNote(scope, leadId, trimmed);
  if (!note) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  const scope = await requireTrainerOrThrow();
  const deleted = await deleteNote(scope, noteId);
  if (!deleted) {
    return { ok: false, error: "notFound" };
  }
  refresh();
  return { ok: true };
}

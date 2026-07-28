"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Note } from "@/db/schema";
import { createNoteAction, deleteNoteAction } from "@/lib/actions/notes";
import { sl } from "@/lib/strings";

export function NotesPanel({ leadId, notes }: { leadId: string; notes: Note[] }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const body = String(formData.get("body") ?? "");
    startTransition(async () => {
      const result = await createNoteAction(leadId, body);
      if (!result.ok) {
        toast.error(sl.errors.validation);
        return;
      }
      formRef.current?.reset();
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteNoteAction(noteId);
      if (!result.ok) {
        toast.error(sl.errors.unexpected);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sl.leads.notesTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{sl.leads.notesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p>{note.body}</p>
                  <p className="text-xs text-muted-foreground">{note.createdAt.toLocaleString("sl-SI")}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(note.id)}
                  disabled={isPending}
                >
                  {sl.leads.deleteNoteButton}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
          <Textarea name="body" placeholder={sl.leads.addNotePlaceholder} required />
          <Button type="submit" size="sm" disabled={isPending} className="self-end">
            {sl.leads.addNoteButton}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

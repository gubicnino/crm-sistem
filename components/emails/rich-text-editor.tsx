"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, SquareMousePointer, User, UserCog } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { EmailDocNode } from "@/db/types";
import { CtaButton, Variable } from "@/lib/email/tiptap-extensions";
import { sl } from "@/lib/strings";

const EMPTY_DOC: EmailDocNode = { type: "doc", content: [{ type: "paragraph", content: [] }] };

/**
 * Rich-text editor for one sequence step's body. Uncontrolled-ish by
 * design: Tiptap owns its own DOM/selection state, and `onChange` fires the
 * document JSON up to react-hook-form on every edit — see
 * components/emails/sequence-form.tsx's Controller usage. `value` is only
 * read once at mount and again if the parent explicitly resets it (e.g.
 * switching which step is being edited), never on every keystroke — that
 * matches how the editor is actually used here, and applying an incoming
 * `value` on every render would fight the user's own typing.
 */
export function RichTextEditor({ value, onChange }: { value: EmailDocNode; onChange: (doc: EmailDocNode) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: false },
        // Disabled: not part of the allowed set in lib/validation/email-doc.ts.
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
      }),
      Variable,
      CtaButton,
    ],
    content: value ?? EMPTY_DOC,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as EmailDocNode);
    },
  });

  // Resync only when the editor identity itself changes (e.g. this
  // component remounts for a different step) — see the header comment.
  useEffect(() => {
    if (editor && value) {
      editor.commands.setContent(value as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  function insertVariable(name: "leadName" | "trainerName") {
    editor?.chain().focus().insertContent({ type: "variable", attrs: { name } }).run();
  }

  function insertLink() {
    const href = window.prompt(sl.emails.editorLinkPrompt);
    if (!href) return;
    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function insertButton() {
    const label = window.prompt(sl.emails.editorButtonLabelPrompt);
    if (!label) return;
    const href = window.prompt(sl.emails.editorButtonHrefPrompt);
    if (!href) return;
    editor?.chain().focus().insertContent({ type: "ctaButton", attrs: { label, href } }).run();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2">
      <div className="flex flex-wrap gap-1 border-b pb-2">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon-sm"
          title={sl.emails.editorBold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon-sm"
          title={sl.emails.editorItalic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title={sl.emails.editorLink} onClick={insertLink}>
          <LinkIcon />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Button>
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon-sm"
          title={sl.emails.editorBulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="icon-sm"
          title={sl.emails.editorOrderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => insertVariable("leadName")}>
          <User /> {sl.emails.editorInsertLeadName}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => insertVariable("trainerName")}>
          <UserCog /> {sl.emails.editorInsertTrainerName}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={insertButton}>
          <SquareMousePointer /> {sl.emails.editorInsertButton}
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}

"use client";

import { getMarkRange } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, SquareMousePointer, User, UserCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailDocNode } from "@/db/types";
import { CtaButton, Variable } from "@/lib/email/tiptap-extensions";
import { sl } from "@/lib/strings";

const EMPTY_DOC: EmailDocNode = { type: "doc", content: [{ type: "paragraph", content: [] }] };

/** Default content for a fresh link/button insert — editor-display-only,
 *  same precedent as this module's VARIABLE_LABELS import: never sent,
 *  the trainer immediately overwrites it via the popover that opens right
 *  after insert. */
const DEFAULT_LINK_TEXT = "Povezava";
const DEFAULT_BUTTON_LABEL = "Gumb";

const POPOVER_WIDTH = 288;
const POPOVER_HEIGHT_ESTIMATE = 200;

/** Mirrors (does not replace) lib/validation/email-doc.ts's isSafeHref —
 *  that Zod check is the actual security boundary; this is client-side-only
 *  convenience so Save can be disabled before an invalid href round-trips. */
function isSafeHref(href: string): boolean {
  return /^(https:|http:|mailto:)/i.test(href);
}

/** Locates the just-inserted placeholder link text node. Inserting inline
 *  text at a position that isn't already inside a paragraph's inline
 *  content (e.g. right where a block atom like ctaButton sits) makes
 *  Tiptap restructure the doc, so the pre-insert position can't be trusted
 *  — search for the placeholder by its distinctive text+href instead. */
function findPlaceholderLinkRange(doc: ProseMirrorNode, nearPos: number): { from: number; to: number } | null {
  const candidates: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (
      node.isText &&
      node.text === DEFAULT_LINK_TEXT &&
      node.marks.some((mark) => mark.type.name === "link" && mark.attrs.href === "#")
    ) {
      candidates.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, candidate) =>
    Math.abs(candidate.from - nearPos) < Math.abs(closest.from - nearPos) ? candidate : closest,
  );
}

interface LinkPopoverState {
  kind: "link";
  isNewInsert: boolean;
  from: number;
  to: number;
  text: string;
  href: string;
}

interface ButtonPopoverState {
  kind: "button";
  isNewInsert: boolean;
  pos: number;
  label: string;
  href: string;
}

type PopoverState = LinkPopoverState | ButtonPopoverState;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

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
    // Closes the popover once the cursor/selection leaves the link or
    // button it was opened for — e.g. the trainer clicks elsewhere in the
    // doc. Deliberately does NOT run the cancel-delete cleanup (see
    // closePopover below): this is a plain dismiss, not a cancel.
    onSelectionUpdate: ({ editor }) => {
      setPopover((prev) => {
        if (!prev) return prev;
        const { from, to } = editor.state.selection;
        if (prev.kind === "link") {
          return from >= prev.from && to <= prev.to ? prev : null;
        }
        return from === prev.pos || to === prev.pos + 1 ? prev : null;
      });
    },
    editorProps: {
      handleClick(view, pos) {
        const { state } = view;
        const $pos = state.doc.resolve(pos);
        const linkType = state.schema.marks.link;
        const linkMark = linkType ? $pos.marks().find((mark) => mark.type === linkType) : undefined;
        if (linkMark) {
          const range = getMarkRange($pos, linkType);
          if (range) {
            const text = state.doc.textBetween(range.from, range.to);
            setPopover({
              kind: "link",
              isNewInsert: false,
              from: range.from,
              to: range.to,
              text,
              href: (linkMark.attrs.href as string) ?? "",
            });
            positionPopoverAt(range.to);
            return false;
          }
        }
        const nodeAfter = state.doc.nodeAt(pos);
        const nodeBefore = pos > 0 ? state.doc.nodeAt(pos - 1) : null;
        const isButtonAfter = nodeAfter?.type.name === "ctaButton";
        const isButtonBefore = !isButtonAfter && nodeBefore?.type.name === "ctaButton";
        if (isButtonAfter || isButtonBefore) {
          const buttonNode = isButtonAfter ? nodeAfter : nodeBefore;
          const buttonPos = isButtonAfter ? pos : pos - 1;
          setPopover({
            kind: "button",
            isNewInsert: false,
            pos: buttonPos,
            label: (buttonNode!.attrs.label as string) ?? "",
            href: (buttonNode!.attrs.href as string) ?? "",
          });
          positionPopoverAt(buttonPos);
          return false;
        }
        setPopover(null);
        return false;
      },
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

  function positionPopoverAt(pos: number) {
    if (!containerRef.current) return;
    const coords = editor!.view.coordsAtPos(pos);
    const containerRect = containerRef.current.getBoundingClientRect();
    const maxLeft = Math.max(containerRect.width - POPOVER_WIDTH, 0);
    const maxTop = Math.max(containerRect.height - POPOVER_HEIGHT_ESTIMATE, 0);
    setPopoverPos({
      top: Math.min(Math.max(coords.bottom - containerRect.top + 4, 0), maxTop),
      left: Math.min(Math.max(coords.left - containerRect.left, 0), maxLeft),
    });
  }

  function insertVariable(name: "leadName" | "trainerName") {
    editor!.chain().focus().insertContent({ type: "variable", attrs: { name } }).run();
  }

  function insertLink() {
    const { from, to, empty } = editor!.state.selection;
    // A NodeSelection (e.g. left over from clicking a button) is never
    // `empty` but also has no real text to wrap — textBetween returns ""
    // for it, so fall back to inserting a fresh placeholder just like the
    // no-selection case rather than trying to mark a non-text range.
    const selectedText = empty ? "" : editor!.state.doc.textBetween(from, to);
    if (selectedText.length === 0) {
      editor!
        .chain()
        .focus()
        .insertContentAt(from, { type: "text", text: DEFAULT_LINK_TEXT, marks: [{ type: "link", attrs: { href: "#" } }] })
        .run();
      const range = findPlaceholderLinkRange(editor!.state.doc, from);
      if (!range) return;
      setPopover({ kind: "link", isNewInsert: true, from: range.from, to: range.to, text: DEFAULT_LINK_TEXT, href: "" });
      positionPopoverAt(range.to);
    } else {
      editor!.chain().focus().setTextSelection({ from, to }).extendMarkRange("link").setLink({ href: "#" }).run();
      setPopover({ kind: "link", isNewInsert: true, from, to, text: selectedText, href: "" });
      positionPopoverAt(to);
    }
  }

  function insertButton() {
    const beforePos = editor!.state.selection.from;
    editor!
      .chain()
      .focus()
      .insertContent({ type: "ctaButton", attrs: { label: DEFAULT_BUTTON_LABEL, href: "#" } })
      .run();
    // insertContent (a block atom, mid-paragraph) may split/restructure the
    // doc, so the node's real position can differ from beforePos — locate
    // it by its placeholder href ("#" is never a saved value) nearest to
    // where the cursor was, rather than trusting the pre-insert position.
    let pos: number | null = null;
    let bestDistance = Infinity;
    editor!.state.doc.descendants((node, nodePos) => {
      if (node.type.name === "ctaButton" && node.attrs.href === "#") {
        const distance = Math.abs(nodePos - beforePos);
        if (distance < bestDistance) {
          bestDistance = distance;
          pos = nodePos;
        }
      }
    });
    if (pos === null) return;
    setPopover({ kind: "button", isNewInsert: true, pos, label: DEFAULT_BUTTON_LABEL, href: "" });
    positionPopoverAt(pos);
  }

  function closePopover(cancelled: boolean) {
    if (cancelled && popover?.isNewInsert) {
      if (popover.kind === "link") {
        editor!.chain().focus().deleteRange({ from: popover.from, to: popover.to }).run();
      } else {
        editor!.chain().focus().deleteRange({ from: popover.pos, to: popover.pos + 1 }).run();
      }
    }
    setPopover(null);
  }

  function saveLinkPopover() {
    if (popover?.kind !== "link") return;
    editor!
      .chain()
      .focus()
      .insertContentAt(
        { from: popover.from, to: popover.to },
        { type: "text", text: popover.text, marks: [{ type: "link", attrs: { href: popover.href } }] },
      )
      .run();
    setPopover(null);
  }

  function removeLinkPopover() {
    if (popover?.kind !== "link") return;
    editor!.chain().focus().setTextSelection({ from: popover.from, to: popover.to }).unsetLink().run();
    setPopover(null);
  }

  function saveButtonPopover() {
    if (popover?.kind !== "button") return;
    editor!
      .chain()
      .focus()
      .setNodeSelection(popover.pos)
      .updateAttributes("ctaButton", { label: popover.label, href: popover.href })
      .run();
    setPopover(null);
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
      <div ref={containerRef} className="relative">
        <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none" />
        {popover?.kind === "link" && (
          <div
            className="absolute z-10 flex w-72 flex-col gap-2 rounded-lg border bg-popover p-3 shadow-md"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <div className="flex flex-col gap-1">
              <Label>{sl.emails.editorLinkTextLabel}</Label>
              <Input value={popover.text} onChange={(e) => setPopover({ ...popover, text: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{sl.emails.editorHrefLabel}</Label>
              <Input
                value={popover.href}
                placeholder="https://…"
                onChange={(e) => setPopover({ ...popover, href: e.target.value })}
              />
              {popover.href.length > 0 && !isSafeHref(popover.href) && (
                <p className="text-xs text-destructive">{sl.emails.editorHrefInvalidHint}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={removeLinkPopover}>
                {sl.emails.editorLinkRemove}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => closePopover(true)}>
                  {sl.emails.editorCancel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={popover.text.trim().length === 0 || !isSafeHref(popover.href)}
                  onClick={saveLinkPopover}
                >
                  {sl.emails.editorSave}
                </Button>
              </div>
            </div>
          </div>
        )}
        {popover?.kind === "button" && (
          <div
            className="absolute z-10 flex w-72 flex-col gap-2 rounded-lg border bg-popover p-3 shadow-md"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <div className="flex flex-col gap-1">
              <Label>{sl.emails.editorButtonLabelLabel}</Label>
              <Input value={popover.label} onChange={(e) => setPopover({ ...popover, label: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{sl.emails.editorHrefLabel}</Label>
              <Input
                value={popover.href}
                placeholder="https://…"
                onChange={(e) => setPopover({ ...popover, href: e.target.value })}
              />
              {popover.href.length > 0 && !isSafeHref(popover.href) && (
                <p className="text-xs text-destructive">{sl.emails.editorHrefInvalidHint}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => closePopover(true)}>
                {sl.emails.editorCancel}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={popover.label.trim().length === 0 || !isSafeHref(popover.href)}
                onClick={saveButtonPopover}
              >
                {sl.emails.editorSave}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

# Sequence step editor: click-to-edit links/buttons, heading styling, live preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `window.prompt`-based link/button insertion in the sequence-step rich-text editor with click-to-edit popovers, fix dead CSS that makes headings/lists invisible while editing, and add a live preview panel next to each step.

**Architecture:** Three independent surfaces changed in dependency order: (1) CSS + a label constant export, (2) `RichTextEditor` gets in-editor popover state driven by Tiptap's `handleClick`/`onSelectionUpdate`/`getMarkRange`, no new library, (3) a new `StepPreview` component walks the same `EmailDocNode` tree as the send-time renderer but emits Tailwind HTML, wired into `sequence-form.tsx` behind a two-column grid per step.

**Tech Stack:** Tiptap v3 (`@tiptap/react`, `@tiptap/core`, `@tiptap/starter-kit`), React 19, react-hook-form, Tailwind v4, Zod (untouched).

## Global Constraints

- Do not modify `lib/validation/email-doc.ts` or `lib/email/rich-text.tsx` — they are the send-time security/rendering boundary and are explicitly out of scope.
- No new dependency. `getMarkRange`, `insertContentAt`, `setNodeSelection` all ship from `@tiptap/core`, already a transitive dependency of `@tiptap/react` (verified present in `node_modules/@tiptap/core`).
- `EmailDocNode`'s on-the-wire shape (`db/types.ts`) does not change.
- UI text is Slovenian, added to `lib/strings.ts` under the existing `emails` namespace — except the two Tiptap-node-internal display constants (`VARIABLE_LABELS`, and the new link/button insert-placeholder text), which follow the existing precedent in `lib/email/tiptap-extensions.ts` of living next to the node definition, not in `lib/strings.ts` (that file already deviates from the central-strings rule for this exact reason, with its own comment justifying it).
- Per CLAUDE.md's UI-testing guidance and this feature's own spec (`docs/superpowers/specs/2026-07-30-sequence-editor-richtext-preview-design.md`, "Testing" section), no new automated tests are planned — this is editor/DOM-interaction behavior verified by hand against a running `npm run dev`. Every task ends with a manual-verification step instead of a test-run step, plus `npx tsc --noEmit`. `npm run build` is the final gate in the last task.
- Tenant isolation is not implicated — no query in this feature reads across trainers; `getTrainer(scope)` is already session-scoped.

---

## Task 1: Fix dead editor CSS + export the variable-label constant

**Files:**
- Modify: `app/globals.css`
- Modify: `lib/email/tiptap-extensions.ts:7-10`

**Interfaces:**
- Produces: `VARIABLE_LABELS` becomes an **exported** `Record<EmailDocVariableName, string>` from `lib/email/tiptap-extensions.ts`, values `{ leadName: "[Ime stranke]", trainerName: "[Ime trenerja]" }`. Task 3's `StepPreview` imports this for its literal `leadName` placeholder.

- [ ] **Step 1: Export and rebracket `VARIABLE_LABELS`**

In `lib/email/tiptap-extensions.ts`, change:

```ts
const VARIABLE_LABELS: Record<EmailDocVariableName, string> = {
  leadName: "Ime stranke",
  trainerName: "Ime trenerja",
};
```

to:

```ts
export const VARIABLE_LABELS: Record<EmailDocVariableName, string> = {
  leadName: "[Ime stranke]",
  trainerName: "[Ime trenerja]",
};
```

- [ ] **Step 2: Add `.ProseMirror` block-type styling to `app/globals.css`**

Append this new block at the end of the file (after the existing `@layer base { ... }` block):

```css
@layer base {
  .ProseMirror h2 {
    @apply text-xl font-semibold;
  }
  .ProseMirror h3 {
    @apply text-lg font-semibold;
  }
  .ProseMirror p {
    @apply text-sm leading-relaxed;
  }
  .ProseMirror p + p {
    @apply mt-2;
  }
  .ProseMirror ul {
    @apply list-disc pl-5 text-sm leading-relaxed;
  }
  .ProseMirror ol {
    @apply list-decimal pl-5 text-sm leading-relaxed;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the only change so far is a `const` → `export const` and a CSS-only file).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open `/emails/sequences/new`, type a heading and toggle H2/H3, add a bullet and numbered list. Confirm headings are visibly larger/bolder than body text and list markers (bullets/numbers) are visible. (The variable-chip bracket change and its consumer aren't wired into any UI yet — this is verified visually in Task 2 once the chip renders in the running editor.)

- [ ] **Step 5: Commit**

```bash
git add app/globals.css lib/email/tiptap-extensions.ts
git commit -m "fix: style ProseMirror block types and export variable-chip labels"
```

---

## Task 2: Click-to-edit link/button popovers in `RichTextEditor`

**Files:**
- Modify: `components/emails/rich-text-editor.tsx` (full rewrite of the insert/edit logic and JSX)
- Modify: `lib/strings.ts` (remove 3 dead prompt strings, add popover field strings)

**Interfaces:**
- Consumes: `VARIABLE_LABELS` export from Task 1 (only indirectly — this task doesn't import it, Task 3 does).
- Produces: no change to `RichTextEditor`'s public props (`value: EmailDocNode`, `onChange: (doc: EmailDocNode) => void`) — this task only changes internal behavior, so `sequence-form.tsx`'s existing `<RichTextEditor value={...} onChange={...} />` call site is untouched.

- [ ] **Step 1: Update `lib/strings.ts`**

Remove these three now-dead keys (the `window.prompt` calls they served are being deleted):

```ts
    editorLinkPrompt: "Vnesite spletni naslov (https://...):",
```
```ts
    editorButtonLabelPrompt: "Napis na gumbu:",
    editorButtonHrefPrompt: "Spletni naslov gumba (https://...):",
```

Add these new keys immediately after `editorOrderedList: "Oštevilčen seznam",` (before `editorInsertLeadName`):

```ts
    editorLinkTextLabel: "Besedilo",
    editorHrefLabel: "URL",
    editorLinkRemove: "Odstrani povezavo",
    editorButtonLabelLabel: "Napis",
    editorHrefInvalidHint: "Povezava mora uporabljati https, http ali mailto.",
    editorSave: "Shrani",
    editorCancel: "Prekliči",
```

The full `emails` block's editor-string section should read:

```ts
    editorBold: "Krepko",
    editorItalic: "Ležeče",
    editorLink: "Povezava",
    editorBulletList: "Seznam",
    editorOrderedList: "Oštevilčen seznam",
    editorLinkTextLabel: "Besedilo",
    editorHrefLabel: "URL",
    editorLinkRemove: "Odstrani povezavo",
    editorButtonLabelLabel: "Napis",
    editorHrefInvalidHint: "Povezava mora uporabljati https, http ali mailto.",
    editorSave: "Shrani",
    editorCancel: "Prekliči",
    editorInsertLeadName: "Ime stranke",
    editorInsertTrainerName: "Vaše ime",
    editorInsertButton: "Gumb",
```

- [ ] **Step 2: Rewrite `components/emails/rich-text-editor.tsx`**

Replace the entire file with:

```tsx
"use client";

import { getMarkRange } from "@tiptap/core";
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
    editor.chain().focus().insertContent({ type: "variable", attrs: { name } }).run();
  }

  function insertLink() {
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContentAt(from, { type: "text", text: DEFAULT_LINK_TEXT, marks: [{ type: "link", attrs: { href: "#" } }] })
        .run();
      const insertedTo = from + DEFAULT_LINK_TEXT.length;
      setPopover({ kind: "link", isNewInsert: true, from, to: insertedTo, text: DEFAULT_LINK_TEXT, href: "" });
      positionPopoverAt(insertedTo);
    } else {
      const text = editor.state.doc.textBetween(from, to);
      editor.chain().focus().setTextSelection({ from, to }).extendMarkRange("link").setLink({ href: "#" }).run();
      setPopover({ kind: "link", isNewInsert: true, from, to, text, href: "" });
      positionPopoverAt(to);
    }
  }

  function insertButton() {
    const pos = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .insertContentAt(pos, { type: "ctaButton", attrs: { label: DEFAULT_BUTTON_LABEL, href: "#" } })
      .run();
    setPopover({ kind: "button", isNewInsert: true, pos, label: DEFAULT_BUTTON_LABEL, href: "" });
    positionPopoverAt(pos);
  }

  function closePopover(cancelled: boolean) {
    if (cancelled && popover?.isNewInsert) {
      if (popover.kind === "link") {
        editor.chain().focus().deleteRange({ from: popover.from, to: popover.to }).run();
      } else {
        editor.chain().focus().deleteRange({ from: popover.pos, to: popover.pos + 1 }).run();
      }
    }
    setPopover(null);
  }

  function saveLinkPopover() {
    if (popover?.kind !== "link") return;
    editor
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
    editor.chain().focus().setTextSelection({ from: popover.from, to: popover.to }).unsetLink().run();
    setPopover(null);
  }

  function saveButtonPopover() {
    if (popover?.kind !== "button") return;
    editor
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. If `state.schema.marks.link` or `getMarkRange`/`insertContentAt`/`setNodeSelection` report type errors, check the exact export names in `node_modules/@tiptap/core/dist/index.d.ts` (already confirmed present at time of writing this plan) — do not add a dependency, these are already resolvable.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open `/emails/sequences/new`:
1. Click the link toolbar button with no selection → placeholder "Povezava" appears with a popover; type text + `https://example.com`, Save → link renders, click it again → popover reopens pre-filled, edit text and href, Save → both update.
2. Select some existing text, click the link button → popover opens with that text pre-filled and empty href; Save with an invalid href (e.g. `javascript:x`) → Save button stays disabled and a hint shows; fix it to `https://...` → Save enables and applies.
3. Click a link's popover Cancel right after a fresh insert → the placeholder text/link disappears entirely (not left behind un-linked).
4. Click the button toolbar button → "Gumb" placeholder inserts with its popover open; edit label + href, Save → button chip updates. Click it again to confirm re-edit works.
5. Insert a button, Cancel immediately → the placeholder button node is removed from the doc entirely.
6. Insert a variable chip (`leadName`) → confirm it renders as `[Ime stranke]` (bracketed, from Task 1's export) rather than bare `Ime stranke`.
7. Click into a link, then click elsewhere in plain body text → popover closes with no changes made.

- [ ] **Step 5: Commit**

```bash
git add components/emails/rich-text-editor.tsx lib/strings.ts
git commit -m "feat: click-to-edit link/button popovers in sequence step editor"
```

---

## Task 3: Live preview component (`StepPreview`)

**Files:**
- Create: `components/emails/step-preview.tsx`
- Modify: `lib/strings.ts`

**Interfaces:**
- Consumes: `VARIABLE_LABELS` (exported, Task 1) from `@/lib/email/tiptap-extensions`; `substituteVariables` from `@/lib/email/variables` (existing, unchanged signature `(text: string, ctx: SequenceRenderContext) => string`).
- Produces: `StepPreview({ subject, body, trainerName }: { subject: string; body: EmailDocNode; trainerName: string })` — a client component with no other exports. Task 4 imports and renders it per step.

- [ ] **Step 1: Add preview strings to `lib/strings.ts`**

Add these keys to the `emails` block, immediately after `stepAdd: "Dodaj korak",`:

```ts
    stepPreviewLabel: "Predogled e-sporočila",
    previewSubjectPrefix: "Zadeva:",
    previewFooterText: "Če ne želite več prejemati teh e-sporočil, se odjavite tukaj.",
```

- [ ] **Step 2: Create `components/emails/step-preview.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import type { EmailDocNode } from "@/db/types";
import { VARIABLE_LABELS } from "@/lib/email/tiptap-extensions";
import { substituteVariables } from "@/lib/email/variables";
import { sl } from "@/lib/strings";

function resolvePreviewVariable(name: string | undefined, trainerName: string): string {
  if (name === "trainerName") return trainerName;
  if (name === "leadName") return VARIABLE_LABELS.leadName;
  return "";
}

function renderInlineNode(node: EmailDocNode, trainerName: string, key: number): ReactNode {
  switch (node.type) {
    case "text": {
      let content: ReactNode = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") content = <strong key={`b-${key}`}>{content}</strong>;
        else if (mark.type === "italic") content = <em key={`i-${key}`}>{content}</em>;
        else if (mark.type === "link" && mark.attrs?.href) {
          content = (
            <a
              key={`l-${key}`}
              href={mark.attrs.href}
              className="text-primary underline"
              onClick={(event) => event.preventDefault()}
            >
              {content}
            </a>
          );
        }
      }
      return <span key={key}>{content}</span>;
    }
    case "variable":
      return (
        <span key={key} className="font-medium">
          {resolvePreviewVariable(node.attrs?.name, trainerName)}
        </span>
      );
    case "hardBreak":
      return <br key={key} />;
    default:
      return null;
  }
}

function renderInline(nodes: EmailDocNode[] | undefined, trainerName: string): ReactNode[] {
  return (nodes ?? []).map((node, index) => renderInlineNode(node, trainerName, index));
}

function renderBlockNode(node: EmailDocNode, trainerName: string, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="text-sm leading-relaxed text-foreground">
          {renderInline(node.content, trainerName)}
        </p>
      );
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      const className = level === 2 ? "text-xl font-semibold text-foreground" : "text-lg font-semibold text-foreground";
      return level === 2 ? (
        <h2 key={key} className={className}>
          {renderInline(node.content, trainerName)}
        </h2>
      ) : (
        <h3 key={key} className={className}>
          {renderInline(node.content, trainerName)}
        </h3>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="list-disc pl-5 text-sm leading-relaxed text-foreground">
          {(node.content ?? []).map((item, index) => (
            <li key={index}>{renderInline(item.content?.[0]?.content, trainerName)}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal pl-5 text-sm leading-relaxed text-foreground">
          {(node.content ?? []).map((item, index) => (
            <li key={index}>{renderInline(item.content?.[0]?.content, trainerName)}</li>
          ))}
        </ol>
      );
    case "ctaButton":
      return (
        <span key={key} className="mt-3 inline-block rounded-md px-5 py-2.5 text-sm text-white" style={{ background: "#111827" }}>
          {node.attrs?.label}
        </span>
      );
    default:
      return null;
  }
}

/**
 * Live approximation of what a step's email looks like once sent — walks
 * the same EmailDocNode tree as lib/email/rich-text.tsx's
 * renderEmailDocBody, but into Tailwind HTML instead of @react-email
 * components: this is editing feedback, not the send-time renderer, and
 * intentionally does not reuse that renderer or add @react-email/render.
 */
export function StepPreview({ subject, body, trainerName }: { subject: string; body: EmailDocNode; trainerName: string }) {
  const previewSubject = substituteVariables(subject, { leadName: null, trainerName });
  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="rounded-lg bg-card p-4 shadow-sm">
        <p className="mb-3 border-b pb-2 text-xs font-medium text-muted-foreground">
          {sl.emails.previewSubjectPrefix} {previewSubject}
        </p>
        <div className="flex flex-col gap-2">
          {(body.content ?? []).map((node, index) => renderBlockNode(node, trainerName, index))}
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">{sl.emails.previewFooterText}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Manual verification**

This component isn't rendered anywhere yet — defer visual verification to Task 4's manual-verification step, which exercises it live inside `sequence-form.tsx`.

- [ ] **Step 5: Commit**

```bash
git add components/emails/step-preview.tsx lib/strings.ts
git commit -m "feat: add StepPreview component for sequence step live preview"
```

---

## Task 4: Wire the preview into `sequence-form.tsx` and both sequence pages

**Files:**
- Modify: `components/emails/sequence-form.tsx`
- Modify: `app/(dashboard)/emails/sequences/[id]/page.tsx`
- Modify: `app/(dashboard)/emails/sequences/new/page.tsx`

**Interfaces:**
- Consumes: `StepPreview` from Task 3 (`components/emails/step-preview.tsx`); `getTrainer(scope: TrainerScope): Promise<Trainer | null>` from `@/db/queries/trainers` (existing, unchanged).
- Produces: `SequenceForm` gains a required `trainerName: string` prop — both call sites must pass it.

- [ ] **Step 1: Add `trainerName` prop and import to `sequence-form.tsx`**

Change the import block to add:

```ts
import { StepPreview } from "@/components/emails/step-preview";
```

Change the component signature from:

```tsx
export function SequenceForm({ sequence, steps }: { sequence?: EmailSequence; steps?: EmailSequenceStep[] }) {
```

to:

```tsx
export function SequenceForm({
  sequence,
  steps,
  trainerName,
}: {
  sequence?: EmailSequence;
  steps?: EmailSequenceStep[];
  trainerName: string;
}) {
```

- [ ] **Step 2: Restructure each step's `CardContent` into a two-column grid with the preview**

Replace this block (the step-card's `CardContent`, currently `<CardContent className="flex flex-col gap-3">` through its closing `</CardContent>`):

```tsx
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepDayOffsetLabel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={MAX_SCHEDULE_DAYS}
                    {...register(`steps.${index}.dayOffset`, { valueAsNumber: true })}
                  />
                  {rowErrors?.dayOffset && <p className="text-xs text-destructive">{rowErrors.dayOffset.message}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepSubjectLabel}</Label>
                  <Input {...register(`steps.${index}.subject`)} />
                  {rowErrors?.subject && <p className="text-xs text-destructive">{rowErrors.subject.message}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>{sl.emails.stepBodyLabel}</Label>
                <Controller
                  control={control}
                  name={`steps.${index}.body`}
                  render={({ field: bodyField }) => (
                    <RichTextEditor value={bodyField.value} onChange={bodyField.onChange} />
                  )}
                />
                {rowErrors?.body && <p className="text-xs text-destructive">{sl.errors.validation}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label>{sl.emails.stepConditionLabel}</Label>
                <p className="text-xs text-muted-foreground">{sl.emails.stepConditionHint}</p>
                <Controller
                  control={control}
                  name={`steps.${index}.sendOnlyIfStage`}
                  render={({ field: conditionField }) => (
                    <div className="flex flex-wrap gap-3">
                      {NON_TERMINAL_STAGES.map((stage) => {
                        const checked = conditionField.value.includes(stage);
                        return (
                          <label key={stage} className="flex items-center gap-1.5 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                conditionField.onChange(
                                  next
                                    ? [...conditionField.value, stage]
                                    : conditionField.value.filter((s) => s !== stage),
                                );
                              }}
                            />
                            {pipelineStageLabels[stage]}
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
              </div>
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    {sl.emails.stepMoveUp}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    {sl.emails.stepMoveDown}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  {sl.emails.stepDelete}
                </Button>
              </div>
            </CardContent>
```

with:

```tsx
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label>{sl.emails.stepDayOffsetLabel}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={MAX_SCHEDULE_DAYS}
                        {...register(`steps.${index}.dayOffset`, { valueAsNumber: true })}
                      />
                      {rowErrors?.dayOffset && <p className="text-xs text-destructive">{rowErrors.dayOffset.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>{sl.emails.stepSubjectLabel}</Label>
                      <Input {...register(`steps.${index}.subject`)} />
                      {rowErrors?.subject && <p className="text-xs text-destructive">{rowErrors.subject.message}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>{sl.emails.stepBodyLabel}</Label>
                    <Controller
                      control={control}
                      name={`steps.${index}.body`}
                      render={({ field: bodyField }) => (
                        <RichTextEditor value={bodyField.value} onChange={bodyField.onChange} />
                      )}
                    />
                    {rowErrors?.body && <p className="text-xs text-destructive">{sl.errors.validation}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>{sl.emails.stepConditionLabel}</Label>
                    <p className="text-xs text-muted-foreground">{sl.emails.stepConditionHint}</p>
                    <Controller
                      control={control}
                      name={`steps.${index}.sendOnlyIfStage`}
                      render={({ field: conditionField }) => (
                        <div className="flex flex-wrap gap-3">
                          {NON_TERMINAL_STAGES.map((stage) => {
                            const checked = conditionField.value.includes(stage);
                            return (
                              <label key={stage} className="flex items-center gap-1.5 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(next) => {
                                    conditionField.onChange(
                                      next
                                        ? [...conditionField.value, stage]
                                        : conditionField.value.filter((s) => s !== stage),
                                    );
                                  }}
                                />
                                {pipelineStageLabels[stage]}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>{sl.emails.stepPreviewLabel}</Label>
                  <StepPreview
                    subject={watch(`steps.${index}.subject`)}
                    body={watch(`steps.${index}.body`)}
                    trainerName={trainerName}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    {sl.emails.stepMoveUp}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    {sl.emails.stepMoveDown}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  {sl.emails.stepDelete}
                </Button>
              </div>
            </CardContent>
```

- [ ] **Step 3: Pass `trainerName` from the edit page**

In `app/(dashboard)/emails/sequences/[id]/page.tsx`, add the import:

```ts
import { getTrainer } from "@/db/queries/trainers";
```

and after `const enrolledLeads = await listLeadsEnrolledInSequence(scope, id);` add:

```ts
  const trainer = await getTrainer(scope);
```

then change:

```tsx
      <SequenceForm sequence={result.sequence} steps={result.steps} />
```

to:

```tsx
      <SequenceForm sequence={result.sequence} steps={result.steps} trainerName={trainer?.name ?? ""} />
```

- [ ] **Step 4: Pass `trainerName` from the new-sequence page**

In `app/(dashboard)/emails/sequences/new/page.tsx`, add the import:

```ts
import { getTrainer } from "@/db/queries/trainers";
```

and after `if (sequences.length >= MAX_SEQUENCES_PER_TRAINER) { redirect("/emails/sequences"); }` add:

```ts
  const trainer = await getTrainer(scope);
```

then change:

```tsx
      <SequenceForm />
```

to:

```tsx
      <SequenceForm trainerName={trainer?.name ?? ""} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes — this is also where a missing/renamed prop would surface (e.g. if `trainerName` were forgotten at either call site).

- [ ] **Step 6: Manual verification**

Run `npm run dev`:
1. Open `/emails/sequences/new` → each step shows a two-column layout (form fields left, preview right) at desktop width, stacking to one column narrower than `lg`.
2. Type in the Subject field → preview's subject line updates on every keystroke, no lag/debounce.
3. Type/format in the body editor (headings, bold, list, link, button from Task 2) → preview updates live to match, including the button rendering as a dark rounded chip.
4. Insert the `trainerName` variable in the body → preview shows the actual logged-in trainer's name (not a placeholder). Insert `leadName` → preview always shows literal `[Ime stranke]`.
5. Open an *existing* sequence at `/emails/sequences/[id]` → preview renders the saved steps' content correctly, trainer name still resolves.
6. Submit the form (Shrani) with a link/button popover left open → submission is not blocked, and the saved doc matches whatever was currently applied to the editor.

- [ ] **Step 7: Full verification gate**

Run: `npm run build`
Expected: production build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add components/emails/sequence-form.tsx "app/(dashboard)/emails/sequences/[id]/page.tsx" "app/(dashboard)/emails/sequences/new/page.tsx"
git commit -m "feat: wire live email preview into sequence step editor"
```

# Sequence step editor: click-to-edit links/buttons, heading styling, live preview

Date: 2026-07-30

## Problem

`components/emails/rich-text-editor.tsx` (used in `components/emails/sequence-form.tsx` for each sequence step's body) has three usability problems:

1. Inserting a link or a CTA button opens a native `window.prompt` dialog — jarring, not stylable, no way to edit an existing link/button afterward except retyping it.
2. Headings (H2/H3) look visually identical to normal paragraph text while editing, so a trainer can't tell what they've actually set. Root cause: `RichTextEditor` applies Tailwind Typography classes (`prose prose-sm`) but `@tailwindcss/typography` is not installed in this project — those classes are dead. The same root cause means bullet/ordered lists render with no markers either.
3. There is no way to see what the assembled email will actually look like while editing a step — a trainer has to save and check `/emails` or wait for a real send.

Additionally, the `leadName`/`trainerName` variable chips currently render as bare `Ime stranke` / `Ime trenerja` text in the editor, which reads as ambiguous body text rather than a placeholder token.

## Scope

In scope: `components/emails/rich-text-editor.tsx`, `lib/email/tiptap-extensions.ts`, `components/emails/sequence-form.tsx`, `app/globals.css`, the two sequence pages (`app/(dashboard)/emails/sequences/[id]/page.tsx`, `.../new/page.tsx`), and one new component for the live preview.

Out of scope / unchanged: `lib/validation/email-doc.ts` (the Zod schema, node/mark allow-list, href protocol whitelist), `lib/email/rich-text.tsx` (the actual send-time renderer), everything about scheduling/sending. This is purely an editor UX + preview improvement; the on-the-wire `EmailDocNode` shape does not change.

## 1. Click-to-edit links and buttons

Remove both `window.prompt` calls in `rich-text-editor.tsx` (`insertLink`, `insertButton`).

**Insert:**
- **Link button** (toolbar): if there's a text selection, wrap it in a link mark with `href: "#"` (placeholder). If there's no selection, insert placeholder text `"Povezava"` with a link mark `href: "#"`. Either way, immediately open the edit popover (see below) with the current text pre-filled and href empty, so the trainer fills in the real values right away.
- **Button button** (toolbar): insert a `ctaButton` node with `label: "Gumb"`, `href: "#"`, then immediately open the edit popover for that node.

**Edit (click an existing link or button):**
- Detected via `editorProps.handleClick` on `useEditor`: check if the click position has the `link` mark active (`editor.isActive('link')` after setting selection there) or if the node at that position is a `ctaButton`.
- A small floating card is positioned at the click location. Position is computed from `editor.view.coordsAtPos(pos)` (viewport coords) minus the bounding rect of a wrapping `<div style="position: relative">` that already wraps `EditorContent` — plain DOM math, no new library.
- **Link popover:** fields "Besedilo" (text) and "URL" (href), plus "Odstrani povezavo". Save re-writes the entire marked range (found via `getMarkRange` from `@tiptap/core`, already an installed transitive dependency of `@tiptap/react`) with new text + link mark in a single `chain()` call — this is what lets the *displayed text* be edited, not just the href.
- **Button popover:** fields "Napis" (label) and "URL" (href). Save calls `editor.chain().focus().updateAttributes('ctaButton', { label, href }).run()` — valid because clicking an atom node produces a `NodeSelection` on it.
- Both popovers validate href against the same rule as `lib/validation/email-doc.ts`'s `isSafeHref` (must start with `https:`, `http:`, or `mailto:`) before enabling Save — client-side-only convenience; the server-side Zod validation in `lib/validation/email-doc.ts` remains the actual security boundary and is untouched.
- Popover state tracks whether it was opened for a fresh insert or for an existing link/button (`isNewInsert: boolean`). On Save, both cases just write the new attrs/text. On Cancel: if `isNewInsert`, delete the just-inserted placeholder node/text range; if editing an existing link/button, simply close without changes. The popover also closes (without side effects) if selection/focus moves elsewhere while it's open.

## 2. Visual distinction of block types in the editor

Add scoped rules to `app/globals.css` targeting `.ProseMirror` (the class Tiptap puts on its content root), replacing the currently-dead `prose prose-sm` classes on `EditorContent`:

- `h2` — noticeably larger, semibold (e.g. `text-xl font-semibold`)
- `h3` — medium, semibold (e.g. `text-lg font-semibold`)
- `ul` — `list-disc`, `ol` — `list-decimal`, both indented (`pl-5` equivalent) — currently unstyled for the same dead-class reason, fixed alongside since it's the identical root cause
- `p` — normal body text size/line-height/spacing between paragraphs
- Bold/italic marks are unaffected (browser defaults already render correctly per the reported screenshot)

No new dependency (not adding `@tailwindcss/typography`).

### Variable chip label

`lib/email/tiptap-extensions.ts`'s `VARIABLE_LABELS` changes from:
```ts
{ leadName: "Ime stranke", trainerName: "Ime trenerja" }
```
to:
```ts
{ leadName: "[Ime stranke]", trainerName: "[Ime trenerja]" }
```
Editor-display-only change. `lib/email/rich-text.tsx`'s `resolveVariable` (the send-time substitution) is untouched — a real sent email still shows the lead's actual name, never brackets.

## 3. Live preview panel

**New component**: `components/emails/step-preview.tsx` (client component). Props: `subject: string`, `body: EmailDocNode`, `trainerName: string`.

- Walks the same `EmailDocNode` tree shape as `lib/email/rich-text.tsx`'s `renderEmailDocBody`, but renders plain HTML/Tailwind elements (`h2`/`h3`/`p`/`ul`/`ol`/`a`/a styled `<span>` for the CTA button) instead of `@react-email/components` — this is a visual approximation for editing feedback, not a byte-for-byte re-implementation of the send-time renderer, and does not require adding `@react-email/render` as an explicit dependency or rendering into an iframe.
- Wrapped in a card styled to echo `lib/email/templates/layout.tsx`'s `EmailLayout` look (white card on a light-gray background), with a static muted footer line mimicking the real unsubscribe footer text (not a real link — this is a preview, not a functional email).
- **Variable substitution for the preview:**
  - `trainerName` → the real logged-in trainer's name.
  - `leadName` → always rendered literally as `[Ime stranke]` (never substituted), since no specific lead exists at step-editing time.
  - Subject line substituted the same way, reusing `substituteVariables` from `lib/email/variables.ts` with `{ leadName: null, trainerName }` — but note `substituteVariables` operates on the legacy `{{ime}}`/`{{trener}}` token syntax for the subject string, which is unrelated to the rich-text `variable` node; the body's `variable` nodes are resolved directly by the new preview renderer's own small resolver function (mirroring `resolveVariable`'s shape, but with the leadName-bracket special case above).
- **Data plumbing:** both `app/(dashboard)/emails/sequences/[id]/page.tsx` and `.../new/page.tsx` call the existing `getTrainer(scope)` (from `db/queries/trainers.ts`) and pass `trainer.name` into `SequenceForm` as a new `trainerName` prop, which forwards it to each step's `StepPreview`.
- **Live updates:** driven by react-hook-form's `watch(`steps.${index}.subject`)` / `watch(`steps.${index}.body`)` inside `sequence-form.tsx` — pure client-side re-render on every keystroke/toolbar action, no debounce.

### Layout change in `sequence-form.tsx`

Each step's `CardContent` becomes `grid grid-cols-1 lg:grid-cols-2 gap-4`:
- Left column: day-offset/subject inputs, the `RichTextEditor`, the stage-condition checkboxes (unchanged from today).
- Right column: the `StepPreview`, roughly matching the editor's height.
- The move-up/move-down/delete button row stays full-width below both columns.

## Error handling / edge cases

- A link/button popover left open when the trainer clicks "Shrani" (submit the whole form) does not block submission — the popover is purely an editor affordance over the same `EmailDocNode` the form already tracks via `onChange`; whatever is currently applied to the doc is what gets submitted.
- Href validation in the popover mirrors but does not replace `isSafeHref` — a trainer who somehow bypasses the client check (e.g. devtools) still gets rejected by `emailDocSchema` server-side, as today.
- If `editor.view.coordsAtPos` positioning would place the popover outside the visible editor bounds (e.g. clicking a link on the last line), clamp the popover's `top`/`left` to stay within the wrapping container rather than letting it overflow off-screen.
- `getTrainer(scope)` returning `null` (should not happen for an authenticated trainer session, but defensively): fall back to an empty string for `trainerName`, same pattern already used in `lib/email/enroll.ts`/`schedule.ts` (`trainer?.name ?? ""`).

## Testing

- Manual verification in the running dev server (`npm run dev`) against `/emails/sequences/new` and an existing sequence's edit page: insert/edit/remove a link, insert/edit a button, toggle H2/H3 and confirm visual size change, confirm bullet/ordered lists show markers, confirm the preview panel updates live while typing and after each toolbar action, confirm `[Ime trenerja]` shows the real trainer name and `[Ime stranke]` stays literal.
- `npx tsc --noEmit` and `npm run build` must pass (per CLAUDE.md).
- No new automated tests planned beyond existing ones — this is UI/editor behavior best verified by hand per CLAUDE.md's UI-testing guidance; existing `lib/validation/email-doc.ts` and `lib/email/rich-text.tsx` tests (send-time rendering, validation) are untouched and continue to guard the actual security/rendering boundary.

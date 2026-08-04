# Pipeline stage renaming — design

## Problem

Pipeline stage display labels (`lib/labels.ts`'s `pipelineStageLabels`) are a single global, hardcoded `Record<PipelineStage, string>` in Slovenian, imported directly by ~13 files across the dashboard (Kanban, lead filters, stage dropdown, funnel, sequence trigger picker, broadcast recipient badges, applications/leads/leads-detail pages). Every trainer sees the same 5 labels: "E-poštni kontakt", "Prijava prejeta", "Kontaktiran", "Stranka", "Izgubljen".

A trainer wants to rename these display labels (e.g. "Kontaktiran" → "V pogovoru") for their own account, and have that rename show up everywhere the stage appears or is selectable — not just on the Kanban board.

## Explicit non-goals

Confirmed with the user before designing:

- **No changes to the `pipeline_stage` enum itself.** The 5 stages (`email_lead`, `application_received`, `contacted`, `client`, `lost`), their order, `ACTIVE_PIPELINE_STAGES`, `TERMINAL_STAGES`, `pipelineStageRank`, sequence trigger-stage logic, and analytics/funnel math are all keyed by the enum value and are unaffected. Only the *display text* changes. This keeps the feature outside CLAUDE.md's "ask first: changing the pipeline_stage enum" gate.
- No reordering, adding, or deleting stages.
- No cross-trainer effect — this is per-`trainer_id`, consistent with existing tenant isolation.
- Public marketing/demo components (`app/(public)/_components/hero-demo.tsx`, `product-walkthrough-frames.tsx`) keep using the static default map — they don't represent a real trainer.

## Data model

New column on `trainers` (mirrors the existing `applicationQuestions` jsonb column):

```ts
stageLabels: jsonb("stage_labels").$type<Record<PipelineStage, string>>().notNull().default(pipelineStageLabels),
```

- Stores the **full** 5-key record, not a sparse override — chosen over a partial-override-merged-with-defaults approach for read simplicity (every trainer row always has all 5 labels; no merge step at read time).
- `.default(pipelineStageLabels)` means `drizzle-kit generate` emits a `DEFAULT '{...}'::jsonb` in the migration SQL, which Postgres applies to existing rows when the `NOT NULL` column is added — no separate backfill script needed.
- Trade-off accepted: if the *code* default in `lib/labels.ts` ever changes later, already-provisioned trainers' DB rows won't pick that up automatically (they'd need a data migration). Acceptable — stage labels are expected to be edited by trainers going forward, not centrally revised.

## Query layer (`db/queries/trainers.ts`)

One new function, same shape as `updateApplicationQuestions`:

```ts
export async function updateStageLabels(scope: TrainerScope, labels: Record<PipelineStage, string>): Promise<Trainer> {
  const [updated] = await db.update(trainers).set({ stageLabels: labels }).where(eq(trainers.id, scope.trainerId)).returning();
  if (!updated) throw new Error("Trainer not found.");
  return updated;
}
```

No new read function — every page that needs labels already calls or will call `getTrainer(scope)` and reads `trainer.stageLabels` directly.

## Validation (`lib/validation/pipeline.ts`, new file)

A Zod object with the 5 known `PipelineStage` keys (not a generic `z.record`, so a typo'd key is a validation error, not silently dropped):

```ts
export const stageLabelsSchema = z.object({
  email_lead: z.string().trim().min(1).max(30),
  application_received: z.string().trim().min(1).max(30),
  contacted: z.string().trim().min(1).max(30),
  client: z.string().trim().min(1).max(30),
  lost: z.string().trim().min(1).max(30),
});
```

- Max length 30 chosen to fit comfortably in the Kanban column header (`w-64`) and the `Badge` components elsewhere.
- No uniqueness constraint between the 5 labels — cosmetic strings, trainer's own judgment.
- No explicit "reset to default" affordance — a trainer can always retype the original Slovenian text. Kept out per YAGNI; trivial to add later as a button that fills the input with `pipelineStageLabels[stage]`.

## Server Action (`lib/actions/pipeline.ts`, new file)

```ts
export async function updateStageLabelsAction(labels: unknown): Promise<ActionResult> {
  const parsed = stageLabelsSchema.safeParse(labels);
  if (!parsed.success) return { ok: false, error: "validation" };
  const scope = await requireTrainerOrThrow();
  await updateStageLabels(scope, parsed.data);
  refresh();
  return { ok: true };
}
```

Always sends the **full** record (client spreads its current `stageLabels` prop and overrides the one edited key before calling this), matching the full-document-replace convention already used by `updateApplicationQuestionsAction`. `refresh()` (Next 16's `next/cache`) invalidates cached Server Component output the same way `moveLeadStageAction` already does, so every other dashboard page picks up the new labels on next render/navigation without a bespoke revalidation path.

## UI

### New shared component: `components/pipeline/editable-stage-label.tsx`

Client component, single responsibility: click-to-edit text.

- Renders the current label as plain text with a subtle pencil affordance on hover.
- Click/focus swaps it for a text `<input>` (autofocus, select-all).
- `Enter` or blur → calls `onSave(trimmedValue)` (a prop, so this component has no server/action knowledge); `Escape` → reverts without saving.
- Disabled state (mirrors `KanbanColumn`'s existing `disabled` prop) while a save is pending.

### `components/pipeline/kanban-board.tsx`

- Receives `initialStageLabels: Record<PipelineStage, string>` prop (fetched by `app/(dashboard)/pipeline/page.tsx` via `getTrainer(scope)`).
- Holds it in a second `useOptimistic` (alongside the existing `grouped` one), following the same pattern as `handleDragEnd`:
  - optimistically apply the new label,
  - call `updateStageLabelsAction({ ...current, [stage]: next })`,
  - on failure, `toast.error(sl.errors.unexpected)` (optimistic state auto-reverts since `refresh()` is never reached).
- Passes each stage's current label + a `(next) => void` save handler into `KanbanColumn`, and the `lost` label + handler into `LostPanel`.

### `components/pipeline/kanban-column.tsx` / `lost-panel.tsx`

- Column/panel header's `<h2>`/`<span>` text is replaced with `<EditableStageLabel>`.

### Every other consumer (no behavior change, just where the data comes from)

These currently `import { pipelineStageLabels } from "@/lib/labels"` and switch to receiving a `stageLabels: Record<PipelineStage, string>` prop instead, sourced by the nearest Server Component page via `getTrainer(scope)` (adding that call where not already present):

| File | Change |
|---|---|
| `app/(dashboard)/pipeline/page.tsx` | add `getTrainer(scope)` call, pass `stageLabels` to `<KanbanBoard>` |
| `app/(dashboard)/leads/page.tsx` | add `getTrainer(scope)` call, pass `stageLabels` down to row rendering / `<StageActions>` / `<LeadFilters>` |
| `app/(dashboard)/leads/[id]/page.tsx` | already calls `getTrainer(scope)` — just read `.stageLabels` and pass down |
| `app/(dashboard)/applications/page.tsx` | already calls `getTrainer(scope)` — just read `.stageLabels` and pass down |
| `app/(dashboard)/analytics/page.tsx` | add `getTrainer(scope)` call, pass `stageLabels` to funnel label-building and `<Funnel>` |
| `components/analytics/funnel.tsx` | take `stageLabels` prop instead of importing |
| `components/leads/lead-filters.tsx` | take `stageLabels` prop |
| `components/leads/stage-actions.tsx` | take `stageLabels` prop |
| `components/emails/sequence-form.tsx` | take `stageLabels` prop (sourced from its page under `app/(dashboard)/emails/sequences/**`) |
| `components/emails/sequence-list.tsx` | take `stageLabels` prop |
| `components/emails/broadcast-form.tsx` | take `stageLabels` prop (sourced from `app/(dashboard)/emails/send/page.tsx`) |

`lib/labels.ts`'s `pipelineStageLabels` stays as-is — it's still the DB column's default value and the seed value for a brand-new trainer row.

## Testing

Extend `__tests__/pipeline-stages.test.ts`:
- `stageLabelsSchema` rejects empty string, string > 30 chars, and a missing/extra key.
- `updateStageLabelsAction` round-trip: happy path persists and returns `{ ok: true }`; validation failure returns `{ ok: false, error: "validation" }` without touching the DB.

## Migration

`npm run db:generate` after the schema change, then `npm run db:migrate` — standard workflow, no hand-written SQL.

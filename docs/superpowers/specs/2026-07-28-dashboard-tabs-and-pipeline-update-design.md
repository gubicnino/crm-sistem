# Dashboard tabs, pipeline stage shrink, and lead dedup — design

## Context

CLAUDE.md was just updated with a new "Dashboard tabs" section and a simplified
4-stage pipeline (`email_lead → application_received → contacted → client` +
terminal `lost`), replacing the previous 6-stage enum. It also added a new
core architecture rule (#4, "Lead deduplication on form resubmission").

The codebase is already a substantial implementation (auth, leads, kanban,
analytics, cron, email sequences — see `db/`, `lib/`, `app/(dashboard)/`), not
a scaffold. This design brings that implementation in line with the updated
CLAUDE.md spec. It touches six independent areas; each can be reviewed and
implemented as its own unit.

## 1. Pipeline stage enum shrink

`pipelineStageEnum` in `db/schema.ts` drops `call_scheduled` and `offer_sent`,
leaving `email_lead, application_received, contacted, client, lost`.

Existing UI (kanban board/column, stage select, filters) is already driven
generically off `pipelineStageEnum.enumValues`, so no UI code changes are
needed there. Changes required:

- `db/schema.ts` — remove the two enum values; run `npx drizzle-kit generate`
  for the migration. Postgres enum value removal requires the column to be
  rebuilt (drizzle-kit handles this as create-new-enum + alter-column +
  drop-old-enum). Since there's no production data yet, no backfill step is
  needed; if any exists later, `call_scheduled`/`offer_sent` rows must be
  remapped to `contacted`/`client` before the migration runs.
- `lib/pipeline.ts` — remove the two `STUCK_THRESHOLD_DAYS` entries.
- `lib/labels.ts` — remove the two `pipelineStageLabels` entries.
- `scripts/seed-demo.ts` — audit and fix any references to the removed stages.

## 2. Lead deduplication on form resubmission (email-only, cross-source merge)

Decision from discussion: a repeat submission is matched **by email alone**,
regardless of `source`. A `lead_magnet` contact who later submits the full
`application` form becomes the same lead row, merged into `source: "application"`.

- `db/schema.ts` — replace the unique index
  `leads_trainer_id_email_source_unique (trainerId, email, source)` with
  `leads_trainer_id_email_unique (trainerId, email)`.
- `db/queries/leads.ts` — rewrite `createLeadFromIntake`:
  - `onConflictDoNothing` targets `(trainerId, email)`.
  - On conflict, always update `name`, `phone`.
  - If the incoming submission's `source === "application"`: also overwrite
    `answers` and set `source: "application"` (merges a prior `lead_magnet`
    row forward).
  - Stage change only happens when the incoming submission is
    `source === "application"` **and** the existing lead's `stage` is still
    `email_lead` → advance to `application_received`. In every other case
    (already `contacted`, `client`, `lost`, or a `lead_magnet` resubmission)
    the stage is left untouched — a converted or already-contacted lead must
    never move backward on the kanban board just because they filled a form
    again.
  - Update the misleading "never `stage`" comment to describe the new
    conditional rule.

## 3. Full CRUD for the "Stranke" tab

Currently `/leads` only supports read, stage change (`moveLeadStageAction`),
and notes — no manual create, edit, or delete, though CLAUDE.md's dashboard
tabs section promises full CRUD.

- `db/queries/leads.ts` — add scoped `createLead`, `updateLead` (name, email,
  phone), `deleteLead`.
- `lib/actions/leads.ts` — add `createLeadAction`, `updateLeadAction`,
  `deleteLeadAction`, following the existing `moveLeadStageAction` pattern
  (`requireTrainerOrThrow`, `ActionResult`, `refresh()`).
- `lib/validation/` — a new Zod schema for the manual create/edit form
  (distinct from `leadIntakeSchema`, which is the public API contract).
- UI: "Dodaj stranko" button + dialog on `/leads` (manually created leads
  start at `email_lead`); edit affordance on `/leads/[id]` (inline or
  dialog); delete button with a confirmation step. `components/ui/` has no
  `alert-dialog.tsx` yet — add it via `npx shadcn add alert-dialog` (shadcn
  primitives are regenerated, never hand-edited, per CLAUDE.md's directory
  layout note).
- New `sl.leads` strings for the new UI text.

## 4. New tab: "Izpolnjene forme" (`/applications`)

Read-only view. Reuses `listLeads(scope, { source: "application" })` (no new
query) and the existing `AnswersView` component. New route
`app/(dashboard)/applications/page.tsx`: a list of application-source leads,
each linking to `/leads/[id]` or expanding inline to show `AnswersView`. New
`sl.applications` strings, new sidebar nav entry.

## 5. New tab: "Emaili" (`/emails`)

- `db/queries/scheduled-emails.ts` — add `listScheduledEmailsForTrainer(scope)`,
  scoped, joined against `leads` for name/email display.
- New route `app/(dashboard)/emails/page.tsx`: table of sequence step, lead,
  status (`pending/scheduled/sent/canceled/orphaned`), scheduled date. Manual
  cancel button reuses the existing `stopSequenceAction`.
- New `sl.emails` strings, new sidebar nav entry.

## 6. Settings restructure: Vprašanja moves to `/settings/questions`

- New route `app/(dashboard)/settings/questions/page.tsx` hosts the existing
  `QuestionsEditor`.
- `app/(dashboard)/settings/page.tsx` keeps `SiteKeyCard` and adds a link (or
  a `components/ui/tabs.tsx`-based sub-nav) to Vprašanja.
- `app/(dashboard)/layout.tsx` — add nav entries for `/applications` and
  `/emails`; `lib/strings.ts` `sl.nav` gets matching keys.

## Testing

- `npx tsc --noEmit`, `npm run lint`, `npm run build` must pass (per CLAUDE.md
  working conventions).
- Manually exercise: kanban drag across the new 4-stage board; a repeat
  `/api/leads` POST for an existing `email_lead` lead (should advance stage);
  a repeat POST for a `contacted`/`client` lead (should NOT move stage); a
  `lead_magnet` row later resubmitted as `application` (should merge,
  `source` becomes `application`); manual lead create/edit/delete; the two
  new tabs render with seeded demo data.
- `npm run seed:demo` should be re-run and checked against the new stage set.

## Out of scope

- Any change to email sequence definitions, cron behavior, or the
  cancellation trigger set (CLAUDE.md's follow-up-email rules are unchanged).
- Analytics UI changes beyond what falls out automatically from the enum
  shrink (`db/queries/analytics.ts` is already generic over
  `pipelineStageEnum.enumValues`).

---
name: dashboard-tabs
description: 'Behavior and routes for the six CRM dashboard tabs (Stranke, Kanban, Vprašanja, Izpolnjene forme, Analitika, Emaili) under app/(dashboard)/**. Load when building or modifying a dashboard tab or its sub-pages.'
user-invocable: false
---

# Dashboard tabs

`app/(dashboard)/**`, every page behind `requireTrainer()`. The trainer is the only user of all six tabs — the operator only ever provisions a trainer's account and `site_key` (see the `admin-console` skill), never touches these pages as a distinct role.

1. **Stranke** (`/leads`) — full list of every lead, any stage or source. Full CRUD: view, edit, delete, manually create a lead. A manually created lead always starts cold at `email_lead` / `source: "application"` (`createLead` in `db/queries/leads.ts`) — same entry point as a `lead_magnet` capture, regardless of who's adding it.

2. **Kanban** (`/pipeline`) — drag-and-drop over the 4 non-terminal stages (`ACTIVE_PIPELINE_STAGES`, `lib/pipeline.ts`), plus a separate drop panel for `lost` (`components/pipeline/lost-panel.tsx`) — not a 5th column. Every drag ends in `setLeadStage()`; see CLAUDE.md's cancellation-is-mandatory rule and the `email-sequences` skill for what that triggers. Resubmission-driven stage moves (dedup auto-advance) are a *different* code path (`createLeadFromIntake`'s conflict branch) and can visibly move a card without a drag — don't assume every stage change here originated from this tab.

3. **Vprašanja** (`/settings/questions`) — builder for `trainers.applicationQuestions` (jsonb). Must stay fully non-technical: the trainer has no dev background — no raw JSON editing, no jargon, no exposing the underlying question `id`/`type` vocabulary as anything but form controls.

4. **Izpolnjene forme** (`/applications`) — `application`-source leads together with their submitted `answers`, keyed by question `id`. Answer-focused ("what did this lead say"), distinct from Stranke's general CRUD list — don't merge the two views or their query paths.

5. **Analitika** (`/analytics`) — funnel/conversion metrics branching on `source`. Stuck-lead thresholds (`STUCK_THRESHOLD_DAYS`, `lib/pipeline.ts`) are shared with the cron digest (`lib/cron/stuck-leads.ts`) via `isStuck()` — don't hardcode a second threshold here. `email_lead` has no threshold (cold leads sit there indefinitely by design); pipeline rank for cumulative funnel math (`pipelineStageRank`) excludes `lost` entirely rather than guessing at how far a lost lead had progressed.

6. **Emaili** (`/emails`) — visibility into `scheduled_emails`: which step went to which lead, `scheduled`/`sent`/`canceled`/`cancel_failed`/`orphaned` status. A manual cancel action here must go through the same `cancelSequenceForLead` path as automatic cancellation — never a bespoke status update. Two sub-pages reached via buttons on this page, **not** separate sidebar items:
   - **`/emails/sequences`** (+ `/new`, `/[id]`) — trigger + steps editor, enable/disable, "apply to existing leads". Full mechanics in the `email-sequences` skill.
   - **`/emails/send`** — one-off manual broadcast. Also covered in the `email-sequences` skill.

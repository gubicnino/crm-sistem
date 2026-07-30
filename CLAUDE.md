@AGENTS.md

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

A multi-tenant lead capture + CRM system for personal trainers ("Trener Growth Sistem").

Each trainer gets:
- A **separate React website** (its own repo, its own domain — NOT part of this repo)
- An account in **this** application, where they see and manage their leads

This repo contains **only** the central backend + CRM dashboard. It never renders trainer marketing sites.

### The two things this repo does

1. **Public lead ingestion API** — receives form submissions from external trainer websites, authenticated by a public `site_key`
2. **Authenticated CRM dashboard** — where a trainer logs in and manages their own leads (kanban pipeline, notes, analytics)

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Hosting | Vercel |
| Database | Neon Postgres (serverless) |
| ORM | **Drizzle** (not Prisma — do not introduce Prisma) |
| Auth | **Auth.js / NextAuth v5** |
| Styling | Tailwind CSS + shadcn/ui |
| Email | Resend + react-email |
| Follow-up scheduling | **Resend `scheduled_at`** (primary) |
| Daily housekeeping | **Vercel Cron** (safety net only — do not introduce a job queue) |
| Validation | Zod |
| Forms | react-hook-form |
| Drag & drop | dnd-kit |
| Rich text (email step bodies) | Tiptap (`@tiptap/react`, `@tiptap/starter-kit`) |

Do not add dependencies outside this list without being asked. Prefer solving with what is already here.

## Language convention

- **Code, comments, commit messages, variable names, DB columns: English**
- **User-facing UI text: Slovenian**

Never mix these. UI strings live in a central place (e.g. `lib/strings.ts` or per-component constants), not scattered inline, so they can be reviewed for consistent Slovenian.

## Core architecture rules

### 1. Tenant isolation is non-negotiable

Every domain table has a `trainer_id` column. **Every single query must be scoped to the current trainer.**

```ts
// WRONG — leaks other trainers' data
await db.select().from(leads);

// RIGHT
await db.select().from(leads).where(eq(leads.trainerId, session.trainerId));
```

Rules:
- `trainerId` for dashboard queries comes **only from the authenticated session**, never from a URL param, query string, or request body
- If a route handler or server action touches lead data and does not filter by `trainerId`, that is a bug — treat it as blocking
- Prefer a helper (e.g. `getScopedDb(trainerId)` or a `requireTrainer()` guard) over repeating the filter by hand

### 2. Public API vs authenticated dashboard are different trust levels

| | Public ingest (`/api/leads`) | Dashboard (`/app/**`) |
|---|---|---|
| Caller | Anonymous visitor on a trainer's site | Logged-in trainer |
| Identity from | `site_key` in request body | Auth.js session |
| CORS | Open (`*`) — origin is unknown | N/A / same origin |
| Trust in input | Zero — validate everything with Zod | Still validate, but session is trusted |

Never let the public endpoint accept a `trainer_id` directly. It accepts `site_key`, and the server resolves it to a `trainer_id`.

### 3. Trainer websites are external

- No middleware for custom domain routing. No rendering of trainer marketing pages.
- The only contract with trainer sites is the `POST /api/leads` payload shape. If that shape changes, it is a **breaking change** — version it (`/api/v1/leads`) rather than silently altering it.

### 4. Lead deduplication on form resubmission

The public ingest endpoint (`/api/leads`) must match incoming `application`
submissions against existing leads for that trainer **by email** — never
create a second lead for a repeat submission.

Rules:
- Look up an existing lead scoped to `trainerId` + `email`.
- If found: always overwrite `answers` with the latest submission (the
  trainer wants current answers, not a history of old ones).
- Stage handling depends on where the lead currently sits:
  - If `stage` is still `email_lead` (not yet contacted), auto-advance it
    to `application_received`.
  - If `stage` is `contacted`, `client`, or `lost`, **do not move it** —
    only `answers` are refreshed. A converted or already-contacted lead
    must never jump backward on the kanban board just because they filled
    the form out again.
- If no existing lead is found, create a new one at `application_received`
  as usual.

## Dashboard tabs

The CRM dashboard (`app/(dashboard)/**`) has six tabs. The trainer is the
only user of all of them — the only thing you (the operator) ever touch is
provisioning a trainer's `site_key`.

1. **Stranke** (`/leads`) — full list of all leads regardless of stage or
   source. Full CRUD: view, edit, delete, manually create a lead.
2. **Kanban pipeline** (`/pipeline`) — drag-and-drop board over the 4
   pipeline stages, plus a separate area/column for `lost` leads. See
   "Lead deduplication on form resubmission" for how resubmission affects
   card position.
3. **Vprašanja** (`/settings/questions`) — trainer-facing builder for
   `trainers.applicationQuestions`. Must be non-technical: the trainer
   using it has no dev background — no raw JSON editing, no jargon.
4. **Izpolnjene forme** (`/applications`) — dedicated view of
   `application`-source leads together with their submitted `answers`.
   Distinct from "Stranke": this one is answer-focused (drill into what a
   specific lead said), not a general CRUD list.
5. **Analitika** (`/analytics`) — funnel/conversion metrics, branching on
   `source` per the two-lead-source split.
6. **Emaili** (`/emails`) — visibility into `scheduled_emails`: which
   sequence step went to which lead, `scheduled` / `sent` / `canceled`
   status. A manual cancel action must go through the same cancellation
   path as automatic cancellation (see "Follow-up emails" →
   "Cancellation is mandatory"). Two linked sub-pages reached via buttons
   on this page, **not** separate sidebar items:
   - **`/emails/sequences`** (+ `/new`, `/[id]`) — trainer-facing sequence
     editor: create/edit a sequence's trigger + steps, enable/disable,
     "apply to existing leads". See "Follow-up emails" → "Sequences are
     trainer data, not code".
   - **`/emails/send`** — one-off manual broadcast to a trainer-chosen set
     of leads. See "Follow-up emails" → "Manual broadcasts".

## Data model (Drizzle schema)

Core tables in `db/schema.ts`:
- Auth.js tables (users, sessions, accounts) per the Drizzle adapter

### Two lead sources — this distinction drives the whole product

| | `application` | `lead_magnet` |
|---|---|---|
| What | Full coaching application form with the trainer's own custom questions | Email captured in exchange for a free guide |
| Data | Name, email + `answers` jsonb | Usually just email (+ maybe name) |
| Temperature | Hot | Cold |
| Enters pipeline at | `application_received` | `email_lead` |
| Default follow-up | "Prijave" sequence: instant confirmation + booking prompt | "Brezplačni vodič" sequence: guide, then education over days |

These are the two **starter sequences** seeded once per new trainer (`lib/email/default-sequences.ts`, applied by `seedDefaultSequencesForTrainer`) — a starting point the trainer can edit, disable, or add to (up to `MAX_SEQUENCES_PER_TRAINER`), not a hardcoded rule. See "Follow-up emails" → "Sequences are trainer data, not code".

Never collapse the two lead sources into one type. Analytics and pipeline still branch on `source`; email sequences branch on it too by default but a trainer-defined sequence can also target "any source" or a pipeline-stage-entry trigger instead.

### Pipeline stages (enum, in order)

`email_lead` → `application_received` → `contacted` → `client`

Plus a terminal `lost` stage. Store as a Postgres enum; keep the Slovenian display labels in the UI layer, not the DB.

### Custom application questions

Each trainer defines their own questions. These are **data, not code**:

```ts
// trainers.applicationQuestions (jsonb)
[
  { id: "goal", label: "Kakšen je tvoj cilj?", type: "text", required: true },
  { id: "experience", label: "Koliko časa že treniraš?", type: "select", options: [...] }
]
```

The trainer's external React site fetches this config (or has it baked in at build time) and renders the form dynamically. Answers come back keyed by question `id` into `leads.answers`.

**Never hardcode a specific trainer's questions anywhere in this repo.** Adding or changing questions must be a data change, not a deploy.

## Directory layout

```
app/
  (public)/            # marketing site for the product itself
  (dashboard)/         # authenticated trainer CRM — every page requires a session
    leads/              # Stranke — full CRUD lead list, all stages/sources
    pipeline/           # Kanban pipeline board
    applications/       # Izpolnjene forme — application leads + their answers
    analytics/
    emails/             # scheduled/sent email visibility
      sequences/         # trainer-facing sequence editor (list, new, [id])
      send/               # one-off manual broadcast
    settings/
      questions/         # Vprašanja — trainer's application question builder
  api/
    leads/route.ts     # PUBLIC ingest endpoint, CORS open
    cron/
      daily/route.ts     # Vercel Cron: housekeeping + daily digest (NOT sequence sending)
db/
  schema.ts
  index.ts             # drizzle client
  migrations/
lib/
  auth.ts              # Auth.js config
  tenant.ts            # requireTrainer(), scoping helpers
  email/               # react-email templates + Resend client
components/
  ui/                  # shadcn/ui primitives — do not hand-edit, regenerate
```

## Follow-up emails

Two mechanisms with strictly separate jobs. Do not blur them.

### Primary: Resend `scheduled_at` — schedule the whole sequence up front

When a lead enrolls in a sequence, **immediately hand every step to Resend in that same request**, then finish. There is no queue, no worker, no per-lead cron. `lib/email/enroll.ts`'s `scheduleStepsForLead` is the shared reserve→send helptaer both enrollment paths below call.

```ts
// enrolling a lead into one sequence's steps — once, then done
for (const step of steps) {
  const { data } = await resend.emails.send(
    { ...renderTemplate(step, lead), scheduled_at: addDays(new Date(), step.dayOffset).toISOString() },
    { idempotencyKey: reservedRow.id }, // reservedRow.id is the scheduled_emails row minted before send
  );
  // reservedRow was inserted first (status: "pending") to claim the (leadId, sequenceStep, attempt)
  // uniqueness before calling Resend; the row is then updated with resendEmailId + status: "scheduled".
}
```

Rules:
- **Resend allows scheduling up to 30 days ahead.** Any step's `dayOffset` beyond day 30 cannot use this mechanism — `MAX_SCHEDULE_DAYS` (30, `lib/email/constants.ts`) is enforced by Zod at the point the trainer saves a step. If one is ever needed beyond that, ask before building a workaround.
- **Always persist `resendEmailId`.** An email that was scheduled but whose ID was not stored can never be canceled. Treat a missing ID as a bug.
- Pass an **idempotency key** on every `resend.emails.send` call (the reserved `scheduled_emails` row's own id) — this is what makes the reserve→send protocol safe to retry (cron reconciler, a race at enrollment) without a double-send.

### Sequences are trainer data, not code

Sequences are **not** hardcoded in a file — they are rows in `email_sequences` / `email_sequence_steps`, created and edited by the trainer at `/emails/sequences` (`components/emails/sequence-form.tsx`), validated by `emailSequenceFormSchema` (`lib/validation/email-sequences.ts`) both client- and server-side.

A sequence has:
- A **trigger**: `lead_created` (optionally filtered to one `source`, or "any source"), or `stage_entered` (fires when a lead enters a specific non-terminal pipeline stage). Terminal stages (`client`, `lost`) can never be a trigger — that transition already has a mandatory, competing action (cancellation, below).
- **Steps** (`useFieldArray`-managed, reorderable): a `dayOffset` (0–30), a subject, a Tiptap rich-text `body`, and an optional `sendOnlyIfStage` condition (the step only sends while the lead is still in one of the listed non-terminal stages — enforced by cancellation, not by a send-time check, since Resend has already accepted the request by the time the condition would need re-checking).
- Two starter sequences are seeded per new trainer (see "Two lead sources" above) but a trainer can create up to `MAX_SEQUENCES_PER_TRAINER` (5), each with up to `MAX_STEPS_PER_SEQUENCE` (15) steps.

Editing an already-enrolled sequence does **not** retroactively touch leads already mid-sequence unless the trainer explicitly clicks "Uporabi za obstoječe stranke" (`applySequenceToExistingLeadsAction` → `lib/email/reapply.ts`), which re-enrolls them at a bumped `attempt` number (capped at `MAX_APPLY_TO_EXISTING_LEADS_PER_RUN`, 200 — exceeding it is a bug signal, not silently truncated).

Never inline sequence/step logic in a route handler or server action — go through `db/queries/email-sequences.ts` and `lib/email/enroll.ts`.

### Manual broadcasts

Separate from sequences: a trainer can send one **one-off** email to a trainer-chosen set of leads at `/emails/send`, capped at `MAX_BROADCAST_RECIPIENTS` (500). Creates an `email_broadcasts` row plus one `scheduled_emails` row per recipient (`kind: "broadcast"`). Immutable once created — no edit path, only cancellation through the same `scheduled_emails` rows. The compose form mints a `clientRequestId` once per compose session up front specifically so a double-click or a retried request resolves to the same broadcast instead of double-sending — never regenerate it per submit attempt.

### Cancellation is mandatory, not optional

A lead who converts or unsubscribes must not keep receiving the sequence. Cancel the remaining scheduled emails via Resend and mark the rows `canceled`.

Cancel on:
- Lead moves to `client` stage
- Lead moves to `lost` stage
- Unsubscribe
- Trainer manually stops the sequence

Additionally, on **any** non-terminal stage change, `syncScheduledEmailsForLeadStage` (`lib/email/cancel.ts`) cancels any not-yet-sent step whose `sendOnlyIfStage` condition excludes the lead's new stage — this is what makes a per-step stage condition (above) actually take effect: there is no send-time hook to check it, so exclusion is enforced by canceling the row before it would have sent.

Without this, a paying client gets "still thinking about it?" a week after signing up. This is the single most damaging bug this system can produce — hold it to a high standard.

### Safety net: one daily Vercel Cron job

`/api/cron/daily` runs **once per day** and does housekeeping only. It **never sends sequence emails** — that is Resend's job.

It does:
- Reconcile: find leads with no `scheduled_emails` rows (e.g. Resend was down at creation time) and schedule them now
- Flag leads stuck in the same `stage` beyond a threshold
- Send each trainer a daily digest (new leads, stuck leads)

Rules:
- Protect with a `CRON_SECRET` bearer token; return 401 for anything else.
- Must be **idempotent** — two runs in one day must not double-send digests or double-schedule sequences. Check `scheduled_emails` before scheduling anything.
- Cap the work per run. If a run would send more than a sane threshold of emails, log and bail — that signals a bug, not real growth.
- Hobby-plan constraints this design deliberately respects: **once per day only, fires anywhere within the scheduled hour, UTC only.** Never write logic that depends on precise timing or a local timezone.

### Why this split

Sequence timing needs precision and per-lead delays; Resend gives that for free. Housekeeping needs neither. Keeping them separate means the free daily cron is sufficient and no external scheduler (Inngest, QStash, GitHub Actions) is needed. Do not introduce one.

## Security requirements

- **Rate limit** `/api/leads` per `site_key` and per IP. An open, CORS-`*` endpoint will get abused.
- **Honeypot field** on lead forms (hidden input; if filled, silently accept and discard).
- `site_key` is public by design — it identifies, it does not authorize. It must never grant read access to anything.
- Never log full lead payloads (personal data) to console in production.
- All input validated with Zod at the boundary before it reaches Drizzle.

## Commands

```bash
npm run dev              # local dev server
npm run build            # production build — must pass before considering work done
npm run lint
npx tsc --noEmit         # type check
npx drizzle-kit generate # create migration from schema changes
npx drizzle-kit migrate  # apply migrations
npm run seed:demo        # wipe + recreate a demo trainer with realistic leads, notes, and questions (dev/showcase only)
```

## Working conventions

- **Server Components by default.** Add `"use client"` only for genuine interactivity (kanban drag, forms). Do not blanket-mark pages as client components.
- **Server Actions** for dashboard mutations; Route Handlers only for the public API and cron.
- Schema changes go through `drizzle-kit generate` — never hand-write migration SQL, never edit a migration that has been applied.
- Run `npm run build` and `npx tsc --noEmit` before declaring a task complete.
- No `localStorage` for anything that belongs in the database.
- Keep secrets in `.env.local` / Vercel env vars. Never commit them, never inline them.

## When unsure

Ask before:
- Adding a dependency
- Adding any external scheduler or job queue
- Changing the `/api/leads` payload contract
- Changing the pipeline stage enum
- Adding a sequence step beyond day 30 (exceeds Resend's scheduling window)
- Introducing multi-user-per-trainer (team accounts) — the current model assumes one login per trainer

Do not silently "improve" any of these — they are deliberate:
- Tenant isolation by session-derived `trainerId`
- The two-lead-source split (`application` vs `lead_magnet`)
- Resend for sequence timing, cron for housekeeping only
- Persisting `resendEmailId` and canceling on conversion
- The sequence/step/broadcast caps (`MAX_SEQUENCES_PER_TRAINER`, `MAX_STEPS_PER_SEQUENCE`, `MAX_APPLY_TO_EXISTING_LEADS_PER_RUN`, `MAX_BROADCAST_RECIPIENTS`) — product limits, not technical ones; raising one silently hides a bug signal instead of surfacing it
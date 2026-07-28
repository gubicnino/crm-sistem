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

## Data model (Drizzle schema)

Core tables in `db/schema.ts`:

- **`trainers`** — id, name, email, `siteKey` (public, unique, e.g. `pk_janez_8f3a2b`), `applicationQuestions` (jsonb), createdAt
- **`leads`** — id, `trainerId`, name, email, phone, `source` (enum: `application` | `lead_magnet`), `stage` (enum), `answers` (jsonb, null for lead magnet leads), createdAt, updatedAt
- **`notes`** — id, `trainerId`, `leadId`, body, createdAt
- **`scheduled_emails`** — id, `trainerId`, `leadId`, `sequenceStep`, `resendEmailId`, `scheduledFor`, `status` (enum: `scheduled` | `sent` | `canceled`) — tracks every email handed to Resend so it can be canceled later
- Auth.js tables (users, sessions, accounts) per the Drizzle adapter

### Two lead sources — this distinction drives the whole product

| | `application` | `lead_magnet` |
|---|---|---|
| What | Full coaching application form with the trainer's own custom questions | Email captured in exchange for a free guide |
| Data | Name, email + `answers` jsonb | Usually just email (+ maybe name) |
| Temperature | Hot | Cold |
| Enters pipeline at | `application_received` | `email_lead` |
| Follow-up | Fast sequence: instant confirmation + booking prompt | Nurture sequence: guide, then education over days |

Never collapse these into one type. Analytics, pipeline, and email sequences all branch on `source`.

### Pipeline stages (enum, in order)

`email_lead` → `application_received` → `contacted` → `call_scheduled` → `offer_sent` → `client`

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
    leads/
    pipeline/
    analytics/
    settings/
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

When a lead is created, **immediately hand the entire sequence to Resend in that same request**, then finish. There is no queue, no worker, no per-lead cron.

```ts
// on lead creation — once, then done
for (const step of sequenceFor(lead.source)) {
  const { data } = await resend.emails.send({
    ...renderTemplate(step, lead),
    scheduled_at: addDays(new Date(), step.dayOffset).toISOString(),
  });
  await db.insert(scheduledEmails).values({
    trainerId: lead.trainerId,
    leadId: lead.id,
    sequenceStep: step.id,
    resendEmailId: data.id,        // REQUIRED — this is the cancel handle
    scheduledFor: ...,
    status: "scheduled",
  });
}
```

Rules:
- **Resend allows scheduling up to 30 days ahead.** Any sequence step beyond day 30 cannot use this mechanism — if one is ever needed, ask before building a workaround.
- **Always persist `resendEmailId`.** An email that was scheduled but whose ID was not stored can never be canceled. Treat a missing ID as a bug.
- Sequence definitions live declaratively in `lib/email/sequences.ts`, keyed by lead `source`. Never inline sequence logic in a route handler.
- Two distinct sequences, per the product model: fast sequence for `application` leads (instant confirmation + booking prompt), nurture sequence for `lead_magnet` leads (guide, then education).

### Cancellation is mandatory, not optional

A lead who converts or unsubscribes must not keep receiving the sequence. Cancel the remaining scheduled emails via Resend and mark the rows `canceled`.

Cancel on:
- Lead moves to `client` stage
- Lead moves to `lost` stage
- Unsubscribe
- Trainer manually stops the sequence

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
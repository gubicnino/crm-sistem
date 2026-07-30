@AGENTS.md

# CLAUDE.md

## What this project is

A multi-tenant lead capture + CRM system for personal trainers ("Trener Growth Sistem").

Each trainer gets a separate React marketing site (its own repo/domain, **not** part of this repo) plus an account here to manage the leads it sends in. This repo is only: (1) the public lead-ingestion API those external sites POST to, and (2) the authenticated CRM dashboard a trainer logs into. It never renders a trainer's marketing site.

A second, distinct actor exists alongside trainers: the **operator/admin** (`app/(admin)/**`), who provisions trainers via invite and can impersonate one to help debug — see "Admin & impersonation" below.

## Stack deviations

Full dependency list is in `package.json` — this is only the choices that override the obvious default, because getting these wrong means building the wrong architecture, not just picking a worse library:

- **Drizzle**, not Prisma.
- **Resend `scheduled_at`** is the sequence-timing engine; **Vercel Cron runs once a day and is a housekeeping safety net only** — never a job queue, never sequence sending. Don't reach for Inngest/QStash/GitHub Actions.
- Pipeline stage and lead source are real Postgres `pgEnum`s; every other evolving value set in the schema is `text().$type<>()`. This is a deliberate, narrow exception — see "Data model" below before adding a third enum.

## Language convention

- Code, comments, commit messages, identifiers, DB columns: **English**.
- User-facing UI text: **Slovenian**, centralized (`lib/strings.ts` / per-component constants), never scattered inline.

## Tenant isolation — non-negotiable

Every domain table has `trainer_id`. Queries go through `db/queries/**`, and every function there takes a `TrainerScope` (`lib/tenant.ts`) as its first argument — a branded type that can't be satisfied by a raw string, so a `trainerId` that leaked in from a URL param or request body can't silently type-check as one.

```ts
// RIGHT
await db.select().from(leads).where(scoped(leads, scope, eq(leads.id, leadId)));
```

Get a `TrainerScope` from `requireTrainer()` / `requireTrainerOrThrow()` (session-derived — pages vs. Server Actions, respectively) or `systemScope(trainerId, reason)` for the handful of non-session entry points (public ingest, form-config, cron, unsubscribe token, invite redemption, admin console) — `reason` is a closed union so every call site is greppable.

**This is enforced mechanically, not just by convention**: `eslint.config.mjs` bans importing `@/db` outside `db/queries/**`. If you hit that lint error, the fix is a new or existing function in `db/queries/**` — never an eslint-disable. Existing coverage: `__tests__/tenant-scoping.test.ts`.

## Public API vs dashboard trust levels

| | Public ingest (`/api/leads`) | Dashboard (`app/(dashboard)/**`) |
|---|---|---|
| Caller | Anonymous visitor on a trainer's site | Logged-in trainer |
| Identity from | `site_key` in body, resolved server-side | Auth.js session (JWT) |
| CORS | Open (`*`) | Same-origin |
| Trust in input | Zero — Zod at the boundary | Still validated, but session is trusted |

The public endpoint never accepts `trainer_id` directly. `proxy.ts` only checks cookie *presence* to redirect for UX — it is not the authorization boundary (Next 16 dispatches Server Actions as POSTs to the page route, which a matcher can't reliably gate). Every Server Action / data-access function must authorize itself via `lib/tenant.ts`.

## Lead ingestion (`/api/leads`)

Order in `route.ts` is deliberate — re-check the file's comments before reordering: body-size guard → IP rate limit (20/10min, keyed before the `site_key` lookup so the lookup itself can't become an enumeration oracle) → Zod parse → honeypot (`website` field: accept-and-discard, `200 {ok:true}`, indistinguishable from success) → `site_key` lookup (unknown key is also a silent `200`, never 404) → per-`site_key` rate limit (100/hr).

Dedup is an upsert on `(trainerId, email)` — see `createLeadFromIntake` in `db/queries/leads.ts`. A repeat `application` submission overwrites `answers`, merges `source` to `application`, and advances `stage` only *out of* `email_lead`; a lead already `contacted`/`client`/`lost` never moves backward. A `lead_magnet` resubmission only ever refreshes `name`/`phone`.

## Follow-up emails — cancellation is mandatory

`setLeadStage()` in `db/queries/leads.ts` is the **only** place allowed to write `leads.stage` — `eslint.config.mjs` blocks a `.set({ stage: ... })` anywhere else, because `setLeadStage` is the only place that's guaranteed to call `cancelSequenceForLead()` on a `client`/`lost` transition. A paying client getting "still thinking about it?" a week after converting is the single most damaging bug this system can produce.

Sequence mechanics (reserve→send protocol, per-step `sendOnlyIfStage` conditions, the daily reconciler, "apply to existing leads", manual broadcasts) are detailed in the **`email-sequences` skill** — load it before touching `lib/email/**`, `lib/cron/**`, or `app/(dashboard)/emails/**`.

## Admin & impersonation

Undocumented elsewhere, so read this before touching `app/(admin)/**`, `lib/impersonation.ts`, or `lib/actions/admin.ts`: an admin has no `trainers` row and reaches the dashboard only by impersonating one. The actual security boundary is `applyImpersonationUpdate` (`lib/impersonation.ts`) re-reading `token.role` from the **signed JWT**, never from the update payload — `/api/auth/session` is reachable directly by any logged-in user with a CSRF token, so trusting the payload there is a full tenant-isolation bypass. Its own header comment says not to simplify that function; treat that as literal. Registration is invite-only (`invites` table, 7-day token). Full detail in the **`admin-console` skill**.

## Data model

Two lead sources drive the whole product — `application` (hot, full form + `answers` jsonb, enters at `application_received`) vs. `lead_magnet` (cold, usually email-only, enters at `email_lead`). Never collapse them; analytics, pipeline, and default sequences all branch on `source`. Pipeline stages: `email_lead → application_received → contacted → client`, plus terminal `lost`. Custom application questions (`trainers.applicationQuestions` jsonb) are trainer data — never hardcode a trainer's questions in this repo.

`db/schema.ts` is the source of truth and is heavily comment-annotated — read it directly rather than expecting this file to restate it. Query/mutation conventions (naming, the enum exception, migration workflow) are in the **`drizzle` skill**.

## Dashboard tabs

`app/(dashboard)/**`, six tabs, one trainer per account (no team accounts — see "When unsure"): **Stranke** (`/leads`, full CRUD) · **Kanban** (`/pipeline`) · **Vprašanja** (`/settings/questions`, non-technical question builder) · **Izpolnjene forme** (`/applications`, answer-focused view of `application` leads) · **Analitika** (`/analytics`) · **Emaili** (`/emails`, + `/emails/sequences` and `/emails/send` reached via buttons, not sidebar items). Behavior detail for each is in the **`dashboard-tabs` skill** — load it when building or changing one.

## Directory layout

```
app/
  (public)/            # marketing site for the product itself
  (admin)/admin/       # operator console — see "Admin & impersonation"
  (dashboard)/         # authenticated trainer CRM — every page requires a session
    leads/ pipeline/ applications/ analytics/ settings/questions/
    emails/            # + sequences/ (list, new, [id]), send/
  api/
    leads/route.ts     # PUBLIC ingest, CORS open
    v1/form-config/    # PUBLIC, site_key -> applicationQuestions
    cron/daily/route.ts
db/
  schema.ts  index.ts  migrations/
  queries/             # ALL db access — every export takes a TrainerScope
lib/
  auth.ts  tenant.ts  impersonation.ts  invites.ts  pipeline.ts
  email/               # enroll/schedule/cancel/reapply/broadcast, templates/
  cron/                # daily.ts composes reconcile.ts + digest.ts + stuck-leads.ts
  actions/             # Server Actions
  validation/          # Zod schemas
proxy.ts               # cookie-presence redirect only — NOT an authz boundary
```

## Security requirements

- Rate limiting and honeypot on `/api/leads`: see "Lead ingestion" above — don't re-derive these, they're already load-bearing.
- `site_key` is public by design — it identifies, never authorizes.
- Never log full lead payloads (PII) to console in production.
- All boundary input validated with Zod before it reaches Drizzle.

## Commands

```bash
npm run dev                    # local dev server
npm run build                  # must pass before considering work done
npm run lint
npm run typecheck              # tsc --noEmit
npm test                       # vitest run
npm run db:generate            # drizzle-kit generate — never hand-write migration SQL
npm run db:migrate
npm run seed:demo              # wipe + recreate a demo trainer (dev/showcase only)
npm run invite:create          # mint a trainer invite from the CLI
npm run admin:create           # create an operator/admin user
```

## Working conventions

- Server Components by default; `"use client"` only for genuine interactivity.
- Server Actions for dashboard mutations; Route Handlers only for the public API and cron.
- Run `npm run build`, `npm run typecheck`, and `npm test` before declaring work done.
- No `localStorage` for anything that belongs in the database.

## When unsure — ask first

- Adding a dependency, or any external scheduler/job queue.
- Changing the `/api/leads` (or `/api/v1/form-config`) payload contract — version it (`/api/v1/leads`) rather than altering it silently.
- Changing the `pipeline_stage` or `lead_source` enum.
- A sequence step beyond day 30 (exceeds Resend's scheduling window).
- Introducing multi-user-per-trainer — a DB unique index on `trainers.userId` currently enforces one login per trainer.
- Simplifying `lib/impersonation.ts`'s `applyImpersonationUpdate`, or moving a `stage`/`trainer_id` write outside `setLeadStage()` / `db/queries/**`.

Do not silently "improve" — these are deliberate: tenant isolation via `TrainerScope` + the two eslint guardrails · the two-lead-source split · Resend for timing / cron for housekeeping only · persisting `resendEmailId` and canceling on conversion · the product caps (`MAX_SEQUENCES_PER_TRAINER`, `MAX_STEPS_PER_SEQUENCE`, `MAX_APPLY_TO_EXISTING_LEADS_PER_RUN`, `MAX_BROADCAST_RECIPIENTS`) — exceeding one is a bug signal to surface, not silently truncate.

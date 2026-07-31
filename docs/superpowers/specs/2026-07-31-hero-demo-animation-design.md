# Hero demo animation — design

Date: 2026-07-31
Status: Approved

## Problem

The hero section (`app/(public)/_components/hero.tsx`) currently shows a static screenshot (`dashboard-pipeline.png`) in its right column. This doesn't tell the product's actual story — that a visitor fills out a trainer's application form and the system automatically captures, organizes, and follows up with them. A looping animated mockup replaces the static image to show that story at a glance.

## Story (what the loop shows, in order)

The demo is a live recreation of the actual `npm run seed:demo` account — same 6 application questions (`scripts/seed-demo.ts`'s `updateApplicationQuestions` call), same seeded lead ("Ana Kovač", `ana.kovac@example.com`, answers `{ goal: "Shujšati 5 kg", experience: "Manj kot leto" }`). Not invented copy, so it can't visually drift from what a trainer's real form/CRM look like.

1. A small "browser window" mock renders the 6 real seeded questions (text, select, text, textarea, select, checkbox — the real type mix, not a simplified one). Only the two she actually answered (goal, experience) animate in with values; the other four stay visibly present but empty, matching a real optional-field submission.
2. Submit button pulses on "click".
3. A compact lead chip (avatar + name) launches from the button toward the CRM panel. The CRM screen itself only fades in once the chip arrives (not mid-flight) — avoids the chip and the full detail header being visible/overlapping at the same time.
4. The CRM screen mirrors the real `/leads/[id]` layout (`app/(dashboard)/leads/[id]/page.tsx`): name + "Prijava · Prijava prejeta" subtitle, small `Kontaktni podatki` and `Odgovori` cards using the exact `lib/strings.ts` labels, answers matching the seeded lead.
5. A small envelope icon peels off the detail card and flies off — implies the automatic follow-up email firing, visually distinct from the lead chip so it doesn't compete with it.
6. Scene crossfades to a 4-column kanban board using the product's real stage labels/colors (`lib/labels.ts`, `lib/badge-styles.ts`). Since this is a full application (not an email opt-in), the lead card appears directly in **Prijava prejeta** (matching the real `application` → `application_received` dedup rule in `db/queries/leads.ts` — it does not pass through "E-poštni kontakt" first), then hops via absolute-position tweening through **Kontaktiran** → **Stranka**, with a small success checkmark on arrival.
7. Hold briefly on the end state, fade out, loop back to step 1.

Total loop ≈ 10s. Runs continuously (autoplay loop), not scroll-triggered — approved in prior discussion for this hero placement.

## Why this is decorative, not a real form

Per prior discussion: stylized mockup, not real screenshots or a functional form. It reuses real design tokens (`stage-1..4`, `--hot`, `pipelineStageLabels`) so it stays visually authentic to the actual dashboard without coupling to real component internals (`components/pipeline/**` are drag-and-drop, data-bound — wrong tool for a scripted decorative loop).

## Approach

**Framer Motion state machine, single client component**, no new dependency (already the project's animation library — see `hero.tsx`, `mechanism.tsx`, `Stagger`/`Reveal`/`MotionPress`).

- A stage index (`useState<number>`) advances on a `setTimeout` chain (each stage's duration triggers the next), wrapping back to 0 — not `setInterval`, so durations can vary per stage.
- The three screens (form / CRM detail / kanban) are all mounted simultaneously, stacked absolutely, and crossfaded via `animate={{ opacity }}` per stage. One traveling "lead chip" element persists across stages with its `left`/`top` tweened between named positions (button → CRM header → kanban columns) — a hand-computed position table (`POS`) rather than `layoutId`, chosen for predictable control over the exact button-to-panel-to-column path instead of relying on FLIP auto-measurement.
- Respects `useReducedMotion()`: when set, stage progression continues (still informative) but transitions become opacity-only crossfades — no flying/sliding motion.
- Entire scene is `aria-hidden="true"` with a short `sr-only` paragraph summarizing what it depicts, since it's decorative and the surrounding hero copy already states the same thing in text.

## Component

- New file: `app/(public)/_components/hero-demo.tsx` ("use client"), replacing the `<Image>` block in `hero.tsx`. Kept inside the same outer `rounded-2xl ring-1 ring-background/15 shadow-2xl shadow-black/40` container and the same entrance transition (`hero.tsx`'s existing `motion.div` wrapper untouched).
- Colocated under `_components/`, not a shared library — single call site, same convention as the rest of the page (per `2026-07-30-public-landing-page-design.md`).
- Constant data (form fields, kanban stages shown, timings) defined at the top of the file or a sibling `hero-demo-data.ts` if the component file grows unwieldy.

## Out of scope

- No real data, no network calls, no connection to `db/queries/**`.
- No scroll-scrubbing (rejected earlier in favor of autoplay loop).
- No changes to `mechanism.tsx` or the rest of the landing page.

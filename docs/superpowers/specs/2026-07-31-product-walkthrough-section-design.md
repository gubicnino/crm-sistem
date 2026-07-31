# Product walkthrough section (Attio-style sticky steps) — design

Date: 2026-07-31
Status: Approved

## Problem

The landing page currently jumps from the hero straight into a 4-icon "how it works" recap (`mechanism.tsx`) and a tab-based screenshot gallery (`product-tour.tsx`). Neither actually walks a visitor through the product step by step with a persistent sense of "where am I in the story." The user wants an Attio-style (attio.com) scrolling section: a fixed list of steps on the left that highlights whichever one you've scrolled to, while the right side shows a short looping animation for that step, styled to look like a real recording of the actual app (same visual language as `hero-demo.tsx`), not a generic illustration.

`mechanism.tsx` and `product-tour.tsx` are **kept unchanged** — this is an additional section, not a replacement. Some topical overlap with them is accepted as a deliberate trade-off (explicitly chosen over merging/replacing).

## Placement

`app/(public)/page.tsx` order becomes:

```
Hero → ProductWalkthrough (new) → Mechanism → ProductTour → AudienceFit → ...
```

New section id: `id="sistem"`. `navbar.tsx`'s `navLinks` array mirrors page order, so the new entry (`{ href: "#sistem", label: "Sistem" }`) is inserted **first**, before the existing `#kako-deluje` entry. No other navbar changes; its existing `IntersectionObserver` scroll-spy already handles any section with a registered id.

## The 5 steps

Each step maps to a real, shipped product surface — nothing invented:

1. **Zajem strank** — "Prijavna forma na tvoji strani samodejno zabeleži vsako povpraševanje — brez ročnega vnašanja." Visual: the form-fill beat (fields animating from empty to filled), same idea as the form screen in `hero-demo.tsx`.
2. **Organizacija leadov** — "Vsaka stranka pristane na enem seznamu — ime, e-pošta, vir in faza na prvi pogled." Visual: a mini `Stranke`-style row list where rows fade in one by one and one row's stage badge highlights.
3. **Kanban pregled** — "Povleci in spusti stranko skozi faze — od povpraševanja do plačljive stranke." Visual: a lead card tweening from one kanban column to the next (reuses the column/card visual language from `hero-demo.tsx`'s kanban screen, but only 2-3 columns, focused on the one movement).
4. **Email avtomatizacije** — "Sistem sam pošilja follow-up sporočila, dokler stranka ne odgovori ali konvertira." Visual: a short sequence-step list where one step's status ticks over to "sent" with a small envelope-icon beat (reuses the envelope beat from `hero-demo.tsx`).
5. **Analitika** — "Spremljaj stopnjo konverzije in vir povpraševanj skozi čas." Visual: a small bar chart drawing in (bars growing from 0) alongside a KPI number using the existing `Counter` component (`counter.tsx`).

Copy lives as a constant array at the top of `product-walkthrough.tsx`, same convention as `mechanism.tsx`'s `steps` array (per-component constants, per `CLAUDE.md`'s language convention — not centralized in `lib/strings.ts` since it's page-specific and single-call-site, matching the precedent set in `2026-07-30-public-landing-page-design.md`).

## Scroll mechanism

**Sticky left list + right column in normal document flow** (not a fully pinned/crossfading two-column unit — that fragile alternative was considered and explicitly rejected for this build).

- Left column: `lg:sticky lg:top-32 lg:self-start`. Renders the 5-item list (title + one-line description). The active item is bold/dark (`text-foreground`); inactive items are muted (`text-muted-foreground/50`), matching the visual weight shown in the Attio reference screenshot.
- Right column: the 5 step blocks stacked in ordinary flow, each roughly `min-h-screen` (or a slightly shorter `min-h-[85vh]` — tune during build to avoid excess empty scroll on short steps) with its animation vertically centered.
- Active-step detection: one `IntersectionObserver` (same technique already proven in `navbar.tsx`'s scroll-spy — `rootMargin: "-45% 0px -50% 0px"`, `threshold: 0`) observing the 5 right-column step blocks, driving a single `activeIndex` state that the left list reads.
- No scroll-jacking, no `useScroll`/`scrollYProgress` transforms, no artificial track height — native scroll speed is untouched.

## Shared visual frame + per-step animations

- New `AppFrame` component (extracted from the "fake browser chrome" wrapper already in `hero-demo.tsx`: the 3-dot header bar + `rounded-2xl bg-card ring-1 ring-foreground/10 shadow-2xl` container) so all 5 step visuals read as the same consistent app window, visually matching the real dashboard.
- Each step's animation is a small, focused, continuously-looping Framer Motion clip — **one moment**, not a multi-stage story like `hero-demo.tsx`. Reuses real design tokens and helpers (`lib/badge-styles.ts`, `lib/labels.ts`, `lib/pipeline.ts`, `avatarTintClass`/`initials` from `lib/display.ts`) — no invented colors, badge shapes, or data shapes.
- `useReducedMotion()` respected: looping animations degrade to a static held frame (or opacity-only crossfade) when set, consistent with `hero-demo.tsx`'s existing pattern.
- Entire visual area is `aria-hidden="true"` per step, with the step's own title+description (visible as real text in the left list / mobile inline header) already conveying the same information.

## Mobile / responsive behavior

Below `lg`, the sticky left list is hidden (`hidden lg:block` / `lg:sticky`). Each of the 5 right-column blocks instead renders its own inline title + description directly above its animation, stacked vertically in document order — the same degradation pattern `mechanism.tsx` already uses on mobile (stagger grid collapses to a vertical list).

## Component architecture

- `app/(public)/_components/product-walkthrough.tsx` — section shell: step copy data, the two-column grid, sticky left list, `IntersectionObserver` wiring, mobile inline headers. `"use client"` (needs the observer + active-index state).
- `app/(public)/_components/product-walkthrough-frames.tsx` — `AppFrame` plus the 5 step animation components (`CaptureFrame`, `OrganizeFrame`, `KanbanFrame`, `EmailFrame`, `AnalyticsFrame` or similar), each colocated since they're single-call-site and share the `AppFrame` wrapper.
- `app/(public)/page.tsx`: one new `<Reveal><ProductWalkthrough /></Reveal>` insertion (consistent with how every other section is wrapped).
- `app/(public)/_components/navbar.tsx`: one new entry in `navLinks`.

## Out of scope for this pass

- No changes to `mechanism.tsx` or `product-tour.tsx` — both stay exactly as they are today.
- No real data, no network calls, no connection to `db/queries/**` — same decorative-only rule as `hero-demo.tsx`.
- No fully-pinned/crossfading scroll-jack variant (considered, rejected for fragility — see "Scroll mechanism" above).
- No new npm dependency — everything built with Framer Motion + Tailwind + existing `lib/**` helpers, already in use elsewhere on this page.

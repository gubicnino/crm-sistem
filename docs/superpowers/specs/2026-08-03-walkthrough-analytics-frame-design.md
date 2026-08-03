# Product walkthrough — Analytics frame parity — design

Date: 2026-08-03
Status: Approved

## Problem

`AnalyticsFrame` in `app/(public)/_components/product-walkthrough-frames.tsx` shows an invented "weekly conversion" mini bar chart (a `Counter` percentage + 4 vertical bars labeled "1. teden" .. "4. teden"). Nothing on the real `/analytics` page looks like this — the real page's signature visual is the two-column funnel comparison ("Lijak konverzije po viru"), built from `Funnel`/`FunnelSection` (`components/analytics/funnel.tsx`). The walkthrough is supposed to be a truthful preview of the product (see the other four frames, which all mirror real seeded data/layouts), so this frame is the odd one out.

## Approach

Replace `AnalyticsFrame`'s content with a miniature version of the real two-funnel comparison only (no stat-tile row — descoped after review to keep the frame uncluttered at walkthrough size).

- Two columns (`grid grid-cols-2`), same source split and copy as the real page: `sl.analytics.funnelApplication` ("Prijava (vroče povpraševanje)") and `sl.analytics.funnelLeadMagnet` ("Lead magnet (hladno povpraševanje)"), each with its dot colored via the same convention as the real `Funnel` component (`bg-hot` / `bg-primary`, matching `page.tsx`'s `dotClassName` props).
- Per column, stacked rows using real `pipelineStageLabels` and `pipelineStageDotClasses` (`db/schema`'s `PipelineStage` enum), matching the counts visible in the reference screenshot:
  - Application funnel: `application_received` 7 → `contacted` 5 → `client` 1.
  - Lead magnet funnel: `email_lead` 3 → `application_received` 1 → `contacted` 1 → `client` 1.
- Between consecutive rows, a small "↓ NN%" drop-off caption, computed the same way the real `Funnel` component does (`round(count / prevCount * 100)`), not hardcoded — keeps the two numbers consistent if the demo counts are ever tweaked.
- Bar width is `count / columnMax * 100%` (same formula as the real component), so relative bar lengths match the screenshot's proportions.

## Animation

Reuses this file's existing `useStageLoop`/`cycle` convention (see current `AnalyticsFrame`, `KanbanFrame`):

- Stages: `"grow" | "hold"`, same durations as today (1200ms / 1400ms) — no need to invent new pacing.
- On each `cycle` (keyed remount of the bars container, same pattern as the current `key={cycle}` div), every row's bar animates `width` from `0` to its target percentage via Framer Motion, staggered per row (`delay: i * 0.15` down each column) so the two funnels visibly fill top-to-bottom rather than popping in at once.
- Drop-off captions fade in alongside their row (`opacity: 0 → 1`, same delay as the row's bar) rather than being present from frame 0, so they read as part of the reveal instead of static chrome.
- `withReducedMotion` applied as it is elsewhere in this file: reduced-motion users get a flat `duration: 0.2` opacity-only transition instead of the width tween.
- `AppFrame` height: kept at the default (`h-80`) — the funnel content is top-aligned under the section title rather than stretched to fill, so the default height leaves the same kind of bottom margin `EmailFrame` already has.

## Out of scope

- No stat-tile row (`StatCard`) — descoped in favor of funnel-only, per review.
- No real data/query wiring — same decorative/hardcoded-constants convention as every other frame in this file.
- No changes to the real `/analytics` page or `components/analytics/**`.
- No changes to `useStageLoop` itself or to any other frame in the file.

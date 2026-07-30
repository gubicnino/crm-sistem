# Public landing page — design

Date: 2026-07-30
Status: Approved

## Problem

`app/(public)/page.tsx` is a one-paragraph placeholder ("exists so `/` isn't a 404"). This repo's `(public)` route group is the marketing site for the CRM product itself (Trener Growth Sistem) — the front door for personal trainers/online coaches deciding whether to request access. There's a wireframe for this page (Claude Design project "CRM Landing Page Wireframe", file `CRM Landing Wireframes.dc.html`) that lays out section structure and flow but uses a hand-drawn sketch style purely as wireframe-annotation convention, not the intended final visual design.

## Content source

The user supplied a full offer document (client acquisition system positioning, ideal client avatar, 8-bonus stack with values, pricing, guarantee terms). This is the single source of truth for copy — see mapping below. Where the offer doc contains open TODOs or exploratory internal notes (tiered pricing, alternate website-only pricing, "Future Expansion" roadmap items), those are **excluded** from this build — only shipped, real features are advertised.

## Section-by-section mapping (wireframe structure → real content)

1. **Hero (split layout)**
   Headline: *"Od Instagram sledilca do plačljive stranke — brez izgubljenih leadov."* (replaces wireframe's calendar-booking framing, which doesn't match this product — there's no scheduling/calendar feature). Subhead drawn from the offer's One Sentence Offer. Primary CTA ("Povprašuj za dostop →") anchor-scrolls to the footer contact form. Visual: real dashboard screenshot(s), not AI-generated.

2. **Mehanizem (4-step horizontal pipeline)**
   Promet (IG/TikTok/spletna stran) → Zajem strank (prijava + lead magnet forma) → CRM & Pipeline (avtomatski follow-up) → Plačljiva stranka. Condensed from the offer's longer mechanism chain to fit the wireframe's 4-box layout.

3. **Za koga je / Ni zate (two columns)**
   Verbatim from the offer's Primary Avatar (✅) and Not Ideal Client (❌) lists.

4. **Bonusi (8-item accordion)**
   All 8 bonuses from the offer, title + monthly value shown collapsed; "Kaj je to" / "Kako pomaga" copy shown expanded. Every bonus maps to a real, shipped feature (lead capture forms with per-trainer custom questions, CRM/lead database, Kanban pipeline, dual email sequences, analytics) except Bonus 5 (positioning strategy), 7 (ongoing support), and 8 (onboarding call), which are service commitments, not software — still legitimate to list as part of the offer.

5. **Value stack (big comparison)**
   €571/mesec (struck through, sum of bonus monthly values) vs **€199/mesec**. Caption below carries a shortened version of the offer's own framing paragraph (what it'd cost to buy each piece separately). The €8.800 one-time-equivalent number from the offer is mentioned only in this caption, not as a second headline comparison — avoids mixing one-time and recurring framing in the primary visual.

6. **Garancija**
   Replaces the wireframe's generic "30-day money-back" badge with the offer's actual terms: first 5 trainers get 1 month free, cancel anytime with no lock-in.

7. **Cenik (pricing box)**
   Single plan: **Trenerski paket — €199/mesec**. Includes list from the offer (Website system, Lead capture, CRM, Pipeline, Automation, Analytics, Maintenance). Guarantee badge inline. CTA anchor-scrolls to contact form. No tiers — the offer doc marks tiering as an open TODO, not a decision.

8. **FAQ (accordion)**
   Not specified in the offer — 4 drafted questions covering the likely objections (technical skill required? already have a website? onboarding time? what happens on cancel?).

9. **Footer (dark, contact form)**
   Ime / email / sporočilo. Client-side validated (react-hook-form + zod). Submit shows a success state. **No backend call, no DB table, no email delivery this round** — purely UI. This is a deliberate scope cut; wiring real submission handling is a separate follow-up if/when needed.

**Excluded from the page entirely:** "Future Expansion" ideas from the offer (Client Portal, AI Coach Assistant, Content Engine) — unbuilt, not advertised as included.

## Visual design system

- Keep `--primary` (brand blue) as the anchor color.
- Reuse the existing `--hot` orange token (already defined in `app/globals.css` for "hot"/application leads) as the marketing CTA/accent color — ties the marketing site back to the product's own palette instead of introducing a new brand color.
- Dark hero + dark footer bookending lighter sections in between, for section-to-section contrast and rhythm.
- Oversized headline type, generous whitespace, large bold/struck-through numerals for the value-stack and pricing sections.
- Typography stays on Geist (`--font-geist-sans`, already loaded) — no new font dependency. Boldness comes from scale, color, and layout rather than a display typeface.
- Real dashboard screenshots (Kanban `/pipeline`, Stranke `/leads`, Analitika `/analytics`) captured from the seeded demo trainer (`npm run seed:demo`) via browser automation, saved as static images under `public/marketing/`, used in the hero and mechanism section.

## Component architecture

- Route: `app/(public)/page.tsx` (replaces the current placeholder).
- Section components live in `app/(public)/_components/` (e.g. `hero.tsx`, `mechanism.tsx`, `audience-fit.tsx`, `bonus-stack.tsx`, `value-stack.tsx`, `guarantee.tsx`, `pricing.tsx`, `faq.tsx`, `contact-footer.tsx`) — colocated, not a shared/reusable `components/marketing/` library, since this page renders in exactly one place.
- Server Components by default; `"use client"` only on the two accordions (bonuses, FAQ) and the contact form (form state).
- Bonuses/FAQ accordions use shadcn's `Accordion` primitive (already available per `components.json`).
- Slovenian copy lives inline in each section component (short, page-specific — doesn't need `lib/strings.ts` centralization since nothing here is reused elsewhere).

## Out of scope for this pass

- No new backend endpoint or DB table for contact-form inquiries.
- No tiered pricing.
- No AI-generated imagery.
- No changes to `/api/leads`, `/api/v1/form-config`, or any trainer-facing dashboard code — this is additive, isolated to `app/(public)/**`.

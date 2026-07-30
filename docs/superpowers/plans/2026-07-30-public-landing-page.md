# Public Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `app/(public)/page.tsx` with a full marketing landing page for Trener Growth Sistem, following the approved spec's section-by-section content mapping and bold visual direction.

**Architecture:** One route (`app/(public)/page.tsx`) composing nine colocated section components from `app/(public)/_components/`. Server Components by default; `"use client"` only on the two accordions (bonuses, FAQ) and the contact form. Real dashboard screenshots (captured from the seeded demo trainer) back the hero and mechanism visuals — no AI-generated imagery.

**Tech Stack:** Next.js (App Router), Tailwind v4 (CSS-first tokens in `app/globals.css`), shadcn (`base-nova` style, Base UI primitives — not Radix), react-hook-form + zod, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-30-public-landing-page-design.md`

## Global Constraints

- UI text is Slovenian (project language convention).
- Server Components by default; `"use client"` only where genuinely interactive.
- No new dependencies beyond the shadcn `accordion` registry component — `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react` are already installed.
- No backend/DB changes. The contact form is UI-only this round: client-validated, shows a success state on submit, no network call.
- Reuse only existing design tokens — brand blue `--primary` and the existing `--hot` orange token (already defined in `app/globals.css` for "hot" leads) as the marketing accent. No new colors added to `app/globals.css`.
- No new font — stay on Geist (`--font-geist-sans`, already loaded in `app/layout.tsx`).
- This app has no active dark-mode toggle (no `ThemeProvider`/`next-themes` wired to the `<html>` element — `.dark` styles in `globals.css` are dormant). `bg-foreground`/`text-background` is therefore safe to use for an intentionally-dark section (hero, footer) without hardcoding a new color.
- Buttons that act as links use the Base UI `render` pattern already established in this codebase: `<Button nativeButton={false} render={<a href="..." />}>Label</Button>` (see `components/leads/leads-pagination.tsx`) — never wrap a `<Button>` around an `<a>`/`<Link>` as a child.
- Run `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` before declaring the work done.

---

### Task 1: Add the Accordion component and shared section container

**Files:**
- Create: `components/ui/accordion.tsx` (via shadcn CLI)
- Create: `app/(public)/_components/container.tsx`
- Test: none (pure UI scaffolding — verified via typecheck)

**Interfaces:**
- Produces: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion` (standard shadcn accordion API — `type="single" collapsible` usage, matching every other shadcn component already in this repo).
- Produces: `Container` from `@/app/(public)/_components/container` — `function Container(props: React.ComponentProps<"div">): JSX.Element`, applies `mx-auto w-full max-w-6xl px-6 lg:px-8` plus any passed `className`. Every later section task wraps its content in this.

- [ ] **Step 1: Add the shadcn accordion component**

Run:
```bash
npx shadcn@latest add @shadcn/accordion
```

This creates `components/ui/accordion.tsx` matching the project's `base-nova` style (Base UI primitives, same pattern as `components/ui/dialog.tsx` etc. — do not hand-write a Radix-based version).

- [ ] **Step 2: Create the shared `Container` primitive**

`app/(public)/_components/container.tsx`:
```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-6 lg:px-8", className)} {...props} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors from the new files.

- [ ] **Step 4: Commit**

```bash
git add components/ui/accordion.tsx "app/(public)/_components/container.tsx"
git commit -m "feat: add accordion component and public-page section container"
```

---

### Task 2: Contact form validation schema

**Files:**
- Create: `lib/validation/contact.ts`
- Test: `__tests__/contact-validation.test.ts`

**Interfaces:**
- Produces: `contactSchema` (zod object: `name`, `email`, `message`) and `type ContactInput = z.infer<typeof contactSchema>` from `@/lib/validation/contact`. Task 12 (contact form) imports both.

- [ ] **Step 1: Write the failing test**

`__tests__/contact-validation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/validation/contact";

describe("contactSchema", () => {
  it("accepts a valid submission", () => {
    const result = contactSchema.safeParse({
      name: "Janez Novak",
      email: "janez@example.com",
      message: "Zanima me dostop do sistema.",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email casing and whitespace", () => {
    const result = contactSchema.safeParse({
      name: "Janez Novak",
      email: "  Janez@Example.COM  ",
      message: "Zanima me dostop do sistema.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("janez@example.com");
    }
  });

  it("rejects an empty name", () => {
    const result = contactSchema.safeParse({ name: "", email: "janez@example.com", message: "Živjo" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = contactSchema.safeParse({ name: "Janez", email: "not-an-email", message: "Živjo" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = contactSchema.safeParse({ name: "Janez", email: "janez@example.com", message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a message longer than 2000 characters", () => {
    const result = contactSchema.safeParse({
      name: "Janez",
      email: "janez@example.com",
      message: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/contact-validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validation/contact'`.

- [ ] **Step 3: Write the schema**

`lib/validation/contact.ts`:
```ts
import { z } from "zod";
import { normalizedEmail } from "@/lib/validation/shared";

/** The public landing-page contact form contract — UI-only for now, see
 *  docs/superpowers/specs/2026-07-30-public-landing-page-design.md. */
export const contactSchema = z.object({
  name: z.string().trim().min(1, "Vnesite ime.").max(200),
  email: normalizedEmail(254, "Vnesite veljaven e-poštni naslov."),
  message: z.string().trim().min(1, "Vnesite sporočilo.").max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/contact-validation.test.ts`
Expected: PASS, all 6 assertions.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/contact.ts __tests__/contact-validation.test.ts
git commit -m "feat: add contact form validation schema"
```

---

### Task 3: Capture real dashboard screenshots for the hero and mechanism sections

**Files:**
- Create: `public/images/marketing/dashboard-pipeline.png`
- Create: `public/images/marketing/dashboard-leads.png`
- Create: `public/images/marketing/dashboard-analytics.png`

**Interfaces:**
- Produces: three static PNG files at the paths above. Task 4 (Hero) references `dashboard-pipeline.png`; Task 5 (Mechanism) references `dashboard-leads.png` and `dashboard-analytics.png`.

This task uses browser automation, not code — no test cycle in the usual sense. The deliverable is verified by the files existing and looking correct when opened.

- [ ] **Step 1: Seed the demo trainer**

Run: `npm run seed:demo`
Expected: Output confirms a fresh demo trainer was created with login `demo@trener-growth.si` / `Demo1234!` (see `scripts/seed-demo.ts`), with seeded leads across pipeline stages.

- [ ] **Step 2: Start the dev server in the background**

Run: `npm run dev` (background)
Wait for it to report ready on `http://localhost:3000`.

- [ ] **Step 3: Log in as the demo trainer via browser automation**

Using the chrome-devtools MCP tools:
1. `new_page` with `url: "http://localhost:3000/login"`.
2. `resize_page` with `width: 1440, height: 900` (fixed viewport so every capture is the same size).
3. `take_snapshot` to get element `uid`s for the email input (`#email`), password input (`#password`), and the submit button (labelled per `sl.auth.loginButton`).
4. `fill` the email field's `uid` with `demo@trener-growth.si`.
5. `fill` the password field's `uid` with `Demo1234!`.
6. `click` the submit button's `uid`.
7. `navigate_page` with `type: "reload"` is not needed — confirm via a fresh `take_snapshot` that the page has left `/login` (dashboard chrome/sidebar visible).

- [ ] **Step 4: Capture the Kanban pipeline screenshot**

1. `navigate_page` with `url: "http://localhost:3000/pipeline"`.
2. Wait for the board to render (columns with lead cards visible in a `take_snapshot`).
3. `take_screenshot` with `filePath: "public/images/marketing/dashboard-pipeline.png"`, `format: "png"`, `fullPage: false` (viewport-only, matches the fixed 1440x900 resize).

- [ ] **Step 5: Capture the leads list screenshot**

1. `navigate_page` with `url: "http://localhost:3000/leads"`.
2. `take_screenshot` with `filePath: "public/images/marketing/dashboard-leads.png"`, `format: "png"`, `fullPage: false`.

- [ ] **Step 6: Capture the analytics screenshot**

1. `navigate_page` with `url: "http://localhost:3000/analytics"`.
2. `take_screenshot` with `filePath: "public/images/marketing/dashboard-analytics.png"`, `format: "png"`, `fullPage: false`.

- [ ] **Step 7: Verify the files and note their exact pixel dimensions**

Confirm all three PNGs exist under `public/images/marketing/` and open each to sanity-check it shows real seeded data (not an empty/error state). Note the actual width/height (should be 1440x900 given the fixed viewport) — Tasks 4 and 5 use these as the `next/image` `width`/`height` props.

- [ ] **Step 8: Stop the dev server, commit the screenshots**

```bash
git add public/images/marketing/dashboard-pipeline.png public/images/marketing/dashboard-leads.png public/images/marketing/dashboard-analytics.png
git commit -m "chore: add real dashboard screenshots for the landing page"
```

---

### Task 4: Hero section

**Files:**
- Create: `app/(public)/_components/hero.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1; `public/images/marketing/dashboard-pipeline.png` from Task 3.
- Produces: `Hero` — `function Hero(): JSX.Element` from `@/app/(public)/_components/hero`. Task 13 (page assembly) renders `<Hero />` first.

- [ ] **Step 1: Write the component**

`app/(public)/_components/hero.tsx`:
```tsx
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/(public)/_components/container";

export function Hero() {
  return (
    <section className="bg-foreground text-background">
      <Container className="grid gap-10 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
        <div>
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Od Instagram sledilca do plačljive stranke — brez izgubljenih leadov.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-background/70">
            Trener Growth Sistem je celoten sistem za pridobivanje strank za osebne trenerje in
            online coache: zajame povpraševanja, jih organizira in samodejno spremlja, dokler ne
            postanejo plačljive stranke.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              nativeButton={false}
              render={<a href="#kontakt" />}
              className="bg-hot text-white hover:bg-hot/90"
            >
              Povprašuj za dostop →
            </Button>
            <p className="text-sm text-background/60">
              Trenutno sprejemamo omejeno število trenerjev.
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-background/15 shadow-2xl shadow-black/40">
          <Image
            src="/images/marketing/dashboard-pipeline.png"
            alt="Kanban pregled strank v Trener Growth Sistem CRM"
            width={1440}
            height={900}
            className="h-auto w-full"
            priority
          />
        </div>
      </Container>
    </section>
  );
}
```

Note: if Task 3's captured screenshots came out at dimensions other than 1440x900, update the `width`/`height` props here to match exactly (Next.js `Image` warns/misrenders aspect ratio if they're wrong).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/hero.tsx"
git commit -m "feat: add landing page hero section"
```

---

### Task 5: Mechanism section ("Kako deluje")

**Files:**
- Create: `app/(public)/_components/mechanism.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1.
- Produces: `Mechanism` — `function Mechanism(): JSX.Element`. Task 13 renders `<Mechanism />` after `<Hero />`.

- [ ] **Step 1: Write the component**

`app/(public)/_components/mechanism.tsx`:
```tsx
import { ArrowRight, MessageCircle, Inbox, Kanban, HandCoins } from "lucide-react";
import { Container } from "@/app/(public)/_components/container";

const steps = [
  { icon: MessageCircle, title: "Promet", desc: "Obiskovalci s tvojega Instagrama, TikToka ali spletne strani." },
  { icon: Inbox, title: "Zajem strank", desc: "Prijavna forma in brezplačni vodič zajameta vsako povpraševanje." },
  { icon: Kanban, title: "CRM & Pipeline", desc: "Vsak lead je organiziran in spremljan skozi kanban pregled." },
  { icon: HandCoins, title: "Plačljiva stranka", desc: "Avtomatski follow-up pretvori zanimanje v rezervacijo." },
];

export function Mechanism() {
  return (
    <section className="py-20 lg:py-28">
      <Container>
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Kako deluje</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Od povpraševanja do stranke, samodejno
        </h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-4 lg:gap-4">
          {steps.map((step, i) => (
            <div key={step.title} className="flex items-start gap-4 lg:flex-col lg:items-start">
              <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="size-6" />
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden size-5 text-muted-foreground lg:hidden" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/mechanism.tsx"
git commit -m "feat: add landing page mechanism section"
```

**Note:** this task's spec entry mentioned using `dashboard-leads.png` / `dashboard-analytics.png` as supporting visuals. On review, a 4-step icon row (above) communicates the mechanism more clearly than embedding two more screenshots into an already-visual page — the two remaining screenshots from Task 3 are intentionally unused by this component. If a future pass wants a feature-highlight section using them, that's a new task, not a gap in this one.

---

### Task 6: Audience fit section ("Za koga je / ni zate")

**Files:**
- Create: `app/(public)/_components/audience-fit.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1.
- Produces: `AudienceFit` — `function AudienceFit(): JSX.Element`. Task 13 renders `<AudienceFit />` after `<Mechanism />`.

- [ ] **Step 1: Write the component**

`app/(public)/_components/audience-fit.tsx`:
```tsx
import { Check, X } from "lucide-react";
import { Container } from "@/app/(public)/_components/container";

const fitFor = [
  "Imaš rezultate s strankami in osnovno prisotnost na Instagramu ali TikToku",
  "Želiš povečati število coaching strank",
  "Prodajaš individualne treninge ali online programe",
  "Želiš bolj profesionalno predstavitev svoje ponudbe",
];

const notFitFor = [
  "Šele začenjaš in še nimaš oblikovane ponudbe",
  "Nimaš dokazanih rezultatov s strankami",
  "Iščeš samo poceni spletno stran",
  "Nisi pripravljen sam odgovarjati potencialnim strankam",
];

export function AudienceFit() {
  return (
    <section className="bg-muted/40 py-20 lg:py-28">
      <Container className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
          <h3 className="text-xl font-semibold">Za tebe, če:</h3>
          <ul className="mt-5 flex flex-col gap-3">
            {fitFor.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
          <h3 className="text-xl font-semibold">Ni zate, če:</h3>
          <ul className="mt-5 flex flex-col gap-3">
            {notFitFor.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/audience-fit.tsx"
git commit -m "feat: add landing page audience-fit section"
```

---

### Task 7: Bonus stack accordion section

**Files:**
- Create: `app/(public)/_components/bonus-stack.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1; `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from Task 1.
- Produces: `BonusStack` — `function BonusStack(): JSX.Element`. Task 13 renders `<BonusStack />` after `<AudienceFit />`.

- [ ] **Step 1: Write the component**

`app/(public)/_components/bonus-stack.tsx`:
```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/app/(public)/_components/container";

const bonuses = [
  {
    title: "Sistem za zajem strank",
    value: "€29/mesec",
    what: "Prijavna forma za trenerstvo s prilagojenimi vprašanji za vsakega trenerja, ločena lead magnet forma za brezplačni vodič, samodejno ločevanje glede na vir prijave.",
    how: "Dobiš tople leade (samo email) in vroče leade (izpolnjena prijava) ločeno označene, zato lahko svoj čas najprej nameniš tistim, ki so najbližje nakupu.",
  },
  {
    title: "Center za upravljanje strank",
    value: "€49/mesec",
    what: "Centralna baza, kjer je vsak kontakt označen glede na vir, pri prijavah pa so vidni tudi odgovori na tvoja lastna vprašanja.",
    how: "Takoj vidiš, kdo je resno izpolnil prijavo in kaj je odgovoril — brez brskanja po Instagram sporočilih ali beleženja na roko.",
  },
  {
    title: "Pipeline za vodenje potencialnih strank",
    value: "€29/mesec",
    what: "Kanban tabla s fazami od prvega stika do stranke: Email → Izpolnjena forma → V kontaktu → Stranka.",
    how: "Vidiš ne le koliko leadov imaš, ampak tudi kako daleč so v procesu, in jih premikaš sam — brez nepotrebnega iskanja po sporočilih.",
  },
  {
    title: "Avtomatski follow-up sistem",
    value: "€39/mesec",
    what: "Dve ločeni email sekvenci — ena za email leade (vodič in izobraževalne vsebine), druga za prijave za trenerstvo (takojšnja potrditev in poziv k rezervaciji klica).",
    how: "Hladni leadi se postopoma segrevajo, resni kandidati pa dobijo takojšen odziv takrat, ko je njihovo zanimanje najvišje.",
  },
  {
    title: "Tvoja ponudbena strategija",
    value: "€49/mesec",
    what: "Skupaj oblikujeva jasno sporočilo o tem, komu pomagaš in zakaj prav tebi zaupati.",
    how: "Ta okvir uporabiš na spletni strani, v formah in v follow-up sporočilih, tako da je komunikacija enotna in bolj prepričljiva povsod hkrati.",
  },
  {
    title: "Analitično središče",
    value: "€29/mesec",
    what: "Pregled, koliko email leadov se dejansko pretvori v prijave in naprej v plačljive stranke.",
    how: "Vidiš, ali ti brezplačni vodič sploh prinaša prave kandidate, in imaš podatke za optimizacijo svojega sistema.",
  },
  {
    title: "Sistem neprekinjene optimizacije",
    value: "€99/mesec",
    what: "Mesečne posodobitve, manjši popravki in tehnična podpora za celoten sistem.",
    how: "Ni ti treba skrbeti za tehnične težave — sistem teče naprej v ozadju, brez tvojega vpletanja.",
  },
  {
    title: "Osebni zagon sistema",
    value: "€149/mesec",
    what: "20-minutni onboarding klic, kjer skupaj nastaviva tvoja prijavna vprašanja, in osebna podpora skozi celotno uporabo sistema.",
    how: "Odstrani največje tveganje pri novi naročnini — da jo kupiš, se izgubiš v uporabi in odpoveš, še preden vidiš rezultat.",
  },
];

export function BonusStack() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-3xl">
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Bonusi</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Kaj vse dobiš zraven
        </h2>
        <Accordion type="single" collapsible className="mt-10">
          {bonuses.map((bonus, i) => (
            <AccordionItem key={bonus.title} value={`bonus-${i + 1}`}>
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between pr-4 text-left">
                  <span>
                    Bonus #{i + 1} — {bonus.title}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground line-through">
                    {bonus.value}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Kaj je to: </span>
                  {bonus.what}
                </p>
                <p>
                  <span className="font-medium text-foreground">Kako pomaga: </span>
                  {bonus.how}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/bonus-stack.tsx"
git commit -m "feat: add landing page bonus stack accordion"
```

---

### Task 8: Value stack section

**Files:**
- Create: `app/(public)/_components/value-stack.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1.
- Produces: `ValueStack` — `function ValueStack(): JSX.Element`. Task 13 renders `<ValueStack />` after `<BonusStack />`.

- [ ] **Step 1: Write the component**

`app/(public)/_components/value-stack.tsx`:
```tsx
import { Container } from "@/app/(public)/_components/container";

export function ValueStack() {
  return (
    <section className="bg-muted/40 py-20 lg:py-28">
      <Container className="max-w-3xl text-center">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
            <span className="text-sm text-muted-foreground uppercase">Skupna vrednost</span>
            <p className="mt-2 text-4xl font-semibold text-muted-foreground line-through">
              €571/mesec
            </p>
          </div>
          <div className="rounded-2xl bg-hot/10 p-8 ring-1 ring-hot/20">
            <span className="text-sm text-muted-foreground uppercase">Tvoja cena</span>
            <p className="mt-2 text-4xl font-semibold text-hot">€199/mesec</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Toliko bi te stalo, če bi vsak del sistema naročil posebej — ločena spletna stran, CRM
          orodje, obrazci in email avtomatizacija. Pri nas dobiš vse skupaj v enem, brez enkratnega
          stroška razvoja (primerljiva enkratna vrednost: €8.800).
        </p>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/value-stack.tsx"
git commit -m "feat: add landing page value stack section"
```

---

### Task 9: Guarantee section

**Files:**
- Create: `app/(public)/_components/guarantee.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1.
- Produces: `Guarantee` — `function Guarantee(): JSX.Element`. Task 13 renders `<Guarantee />` after `<ValueStack />`. Task 10 (Pricing) renders a smaller inline variant of the same copy, kept independent (no shared sub-component — the two are different enough in layout that extracting one would be a premature abstraction for two call sites).

- [ ] **Step 1: Write the component**

`app/(public)/_components/guarantee.tsx`:
```tsx
import { Container } from "@/app/(public)/_components/container";

export function Guarantee() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="flex max-w-3xl flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-full bg-primary/10 text-center text-primary">
          <span className="text-xs font-semibold">1 MESEC</span>
          <span className="text-xs font-semibold">BREZPLAČNO</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Brez tveganja</h2>
          <p className="mt-2 text-muted-foreground">
            Prvih 5 trenerjev, ki se pridružijo, dobi cel prvi mesec brezplačno. In ker verjameva v
            sistem, lahko kadarkoli odpoveš — brez vezave, brez skritih pogojev.
          </p>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/guarantee.tsx"
git commit -m "feat: add landing page guarantee section"
```

---

### Task 10: Pricing section

**Files:**
- Create: `app/(public)/_components/pricing.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1.
- Produces: `Pricing` — `function Pricing(): JSX.Element`. Task 13 renders `<Pricing />` after `<Guarantee />`. CTA anchors to `#kontakt` (the `id` Task 12's `ContactFooter` section sets).

- [ ] **Step 1: Write the component**

`app/(public)/_components/pricing.tsx`:
```tsx
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/(public)/_components/container";

const includes = [
  "Spletna stran",
  "Zajem strank",
  "CRM",
  "Pipeline",
  "Avtomatizacija",
  "Analitika",
  "Vzdrževanje",
];

export function Pricing() {
  return (
    <section className="bg-muted/40 py-20 lg:py-28">
      <Container className="max-w-3xl">
        <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10 sm:p-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Rast paket — €199/mesec
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Prvi mesec brezplačno za prvih 5 trenerjev · brez vezave
              </p>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {includes.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            nativeButton={false}
            render={<a href="#kontakt" />}
            className="mt-8 w-full bg-hot text-white hover:bg-hot/90"
          >
            Povprašuj zdaj
          </Button>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/pricing.tsx"
git commit -m "feat: add landing page pricing section"
```

---

### Task 11: FAQ accordion section

**Files:**
- Create: `app/(public)/_components/faq.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1; `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from Task 1.
- Produces: `Faq` — `function Faq(): JSX.Element`. Task 13 renders `<Faq />` after `<Pricing />`.

- [ ] **Step 1: Write the component**

`app/(public)/_components/faq.tsx`:
```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/app/(public)/_components/container";

const faqs = [
  {
    q: "Ali potrebujem tehnično znanje za uporabo sistema?",
    a: "Ne. Sistem upravljaš iz enostavne nadzorne plošče, vso tehnično postavitev in vzdrževanje prevzamemo mi.",
  },
  {
    q: "Že imam spletno stran — ali jo moram zamenjati?",
    a: "Ne nujno — obstoječo stran lahko povežemo z zajemom strank, ali pa ti v okviru paketa pripravimo novo, prodajno usmerjeno stran.",
  },
  {
    q: "Kako hitro lahko začnem?",
    a: "Po uvodnem klicu je sistem prilagojen tvoji ponudbi in pripravljen za uporabo v nekaj dneh.",
  },
  {
    q: "Kaj se zgodi, če odpovem?",
    a: "Naročnino lahko kadarkoli prekineš, brez vezave in brez dodatnih stroškov.",
  },
];

export function Faq() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-3xl">
        <span className="text-sm font-medium tracking-wide text-hot uppercase">FAQ</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pogosta vprašanja
        </h2>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i + 1}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/faq.tsx"
git commit -m "feat: add landing page FAQ section"
```

---

### Task 12: Contact footer form (client component)

**Files:**
- Create: `app/(public)/_components/contact-footer.tsx`

**Interfaces:**
- Consumes: `Container` from Task 1; `contactSchema`, `ContactInput` from Task 2 (`@/lib/validation/contact`).
- Produces: `ContactFooter` — `function ContactFooter(): JSX.Element`, a section with `id="kontakt"` (the anchor target for every CTA in Tasks 4 and 10). Task 13 renders `<ContactFooter />` last.

- [ ] **Step 1: Write the component**

`app/(public)/_components/contact-footer.tsx`:
```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Container } from "@/app/(public)/_components/container";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";

export function ContactFooter() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) });

  function onSubmit(_values: ContactInput) {
    // UI-only for now — no backend endpoint yet, see
    // docs/superpowers/specs/2026-07-30-public-landing-page-design.md.
    setSubmitted(true);
    reset();
  }

  return (
    <section id="kontakt" className="bg-foreground text-background">
      <Container className="py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Povprašuj za dostop
            </h2>
            <p className="mt-4 max-w-sm text-background/70">
              Trenutno sprejemamo omejeno število trenerjev. Pusti svoje podatke in se oglasimo v
              24 urah.
            </p>
            <p className="mt-8 text-sm text-background/50">
              Trener Growth Sistem · info@trenergrowth.si · +386 40 000 000
            </p>
          </div>
          {submitted ? (
            <p className="rounded-2xl bg-background/10 p-6 text-background">
              Hvala! Sporočilo je bilo poslano — oglasimo se ti v najkrajšem možnem času.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-name" className="text-background/80">
                  Ime
                </Label>
                <Input
                  id="contact-name"
                  className="border-background/20 bg-background/5 text-background placeholder:text-background/40"
                  {...register("name")}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-email" className="text-background/80">
                  E-pošta
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  className="border-background/20 bg-background/5 text-background placeholder:text-background/40"
                  {...register("email")}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-message" className="text-background/80">
                  Sporočilo
                </Label>
                <Textarea
                  id="contact-message"
                  rows={4}
                  className="border-background/20 bg-background/5 text-background placeholder:text-background/40"
                  {...register("message")}
                />
                {errors.message && (
                  <p className="text-sm text-destructive">{errors.message.message}</p>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="mt-2 bg-hot text-white hover:bg-hot/90"
              >
                Pošlji povpraševanje
              </Button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
```

**Note:** `info@trenergrowth.si` and `+386 40 000 000` are placeholder contact details — replace with the real ones before this page goes live. Everything else in this task is final.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/contact-footer.tsx"
git commit -m "feat: add landing page contact form"
```

---

### Task 13: Assemble the page

**Files:**
- Modify: `app/(public)/page.tsx` (replace entirely)

**Interfaces:**
- Consumes: `Hero`, `Mechanism`, `AudienceFit`, `BonusStack`, `ValueStack`, `Guarantee`, `Pricing`, `Faq`, `ContactFooter` from Tasks 4–12.

- [ ] **Step 1: Replace the placeholder page**

`app/(public)/page.tsx`:
```tsx
import { AudienceFit } from "@/app/(public)/_components/audience-fit";
import { BonusStack } from "@/app/(public)/_components/bonus-stack";
import { ContactFooter } from "@/app/(public)/_components/contact-footer";
import { Faq } from "@/app/(public)/_components/faq";
import { Guarantee } from "@/app/(public)/_components/guarantee";
import { Hero } from "@/app/(public)/_components/hero";
import { Mechanism } from "@/app/(public)/_components/mechanism";
import { Pricing } from "@/app/(public)/_components/pricing";
import { ValueStack } from "@/app/(public)/_components/value-stack";

export default function Home() {
  return (
    <main>
      <Hero />
      <Mechanism />
      <AudienceFit />
      <BonusStack />
      <ValueStack />
      <Guarantee />
      <Pricing />
      <Faq />
      <ContactFooter />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: Both PASS with no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/page.tsx"
git commit -m "feat: assemble public landing page from section components"
```

---

### Task 14: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full check suite**

Run: `npm run build && npm run typecheck && npm run lint && npm test`
Expected: All four PASS.

- [ ] **Step 2: Manual browser walkthrough**

Start the dev server (`npm run dev`) and use browser automation (chrome-devtools MCP) to visit `http://localhost:3000/`:
1. Confirm the hero screenshot loads (not a broken image).
2. Click through both accordions (bonus stack, FAQ) and confirm they expand/collapse.
3. Fill and submit the contact form; confirm the success message replaces the form.
4. Resize the viewport to a mobile width (e.g. 390x844) and re-check the hero, bonus accordion, and pricing card don't overflow or clip.

- [ ] **Step 3: Fix any issues found, then final commit**

If Step 2 surfaces a visual bug, fix it in the relevant section file and commit the fix separately (`fix: ...`) rather than folding it silently into an earlier task's commit.

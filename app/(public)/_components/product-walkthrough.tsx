"use client";

import { Container } from "@/app/(public)/_components/container";
import {
    AnalyticsFrame,
    CaptureFrame,
    EmailFrame,
    KanbanFrame,
    OrganizeFrame,
} from "@/app/(public)/_components/product-walkthrough-frames";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

/** Keying each frame by its own on/off state forces React to remount it
 *  across the inactive/active boundary, so useStageLoop's internal timer
 *  state always starts fresh at 0 on (re)activation — the "always restart
 *  from the same beat" behavior is achieved via remount, not via any reset
 *  logic inside the hook itself (which would require reading/writing a ref
 *  during render or calling setState synchronously in an effect body, both
 *  of which this repo's react-hooks/refs and react-hooks/set-state-in-effect
 *  lint rules reject). */
const FRAMES = {
  capture: CaptureFrame,
  organize: OrganizeFrame,
  kanban: KanbanFrame,
  email: EmailFrame,
  analytics: AnalyticsFrame,
} as const;

type StepId = keyof typeof FRAMES;

interface WalkthroughStep {
  id: StepId;
  title: string;
  description: string;
  long_description: string;
}

const STEPS: readonly WalkthroughStep[] = [
  {
    id: "capture",
    title: "Zajem strank",
    description: "Prijavna forma na tvoji strani samodejno zabeleži vsako povpraševanje.",
    long_description: "Na tvojo spletno stran se vgradi prijavna forma, ki vsako povpraševanje samodejno poveže s CRM sistemom, pripravljeno za obravnavo v nekaj sekundah.",
  },
  {
    id: "organize",
    title: "Organizacija kontaktov",
    description: "Vsi kontakti in njihovi podatki zbrani na enem seznamu.",
    long_description: "Nič več iskanja kontaktov po deset različnih aplikacijah in nič več pozabljenih odgovorov. Vsi podatki o kontaktu, od kod je prišel in v kateri fazi je, so zbrani na enem mestu.",
  },
  {
    id: "kanban",
    title: "Kanban pregled",
    description: "Premikanje kontaktov med fazami prodajnega lijaka, dokler ne postanejo plačljive stranke.",
    long_description: "Namesto seznamov in ugibanja imaš vizualni pregled celotnega prodajnega procesa. CRM sistem omogoča vizualno spremljanje in premikanje kontakta skozi različne faze prodajnega procesa, od prvega povpraševanja do končne konverzije.",
  },
  {
    id: "email",
    title: "Email avtomatizacije",
    description: "Nastavljanje avtomatskih emailov sekvenc, ki spremljajo kontakte in jih spodbujajo k konverziji.",
    long_description: "Namesto ročnega pisanja vsakemu posebej nastaviš avtomatske email sekvence, ki se sprožijo ob določenem dogodku in kontakte glede na njihovo fazo počasi vodijo skozi prodajni lijak do plačljivih strank.",
  },
  {
    id: "analytics",
    title: "Analitika",
    description: "Spremljaj stopnjo konverzije in vir povpraševanj skozi čas.",
    long_description: "Vir kontaktov, stopnja konverzije in gibanje skozi čas so prikazani grafično na enem mestu. V realnem času vidiš, kaj v prodaji deluje, in lahko sproti optimiziraš.",
  },
] as const;

export function ProductWalkthrough() {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const index = stepRefs.current.findIndex((el) => el === visible.target);
        if (index !== -1) setActiveIndex(index);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="sistem" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[380px_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-32 lg:h-fit">
            <span className="text-sm font-medium tracking-wide text-hot uppercase">Sistem</span>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              En sistem, od prvega klika do plačljive stranke
            </h2>
            <ul className="mt-8 hidden flex-col gap-6 lg:flex">
              {STEPS.map((step, i) => (
                <li key={step.id}>
                  <p
                    className={cn(
                      "text-lg font-semibold transition-colors duration-300",
                      i === activeIndex ? "text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {step.title}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm transition-colors duration-300",
                      i === activeIndex ? "text-muted-foreground" : "text-muted-foreground/30",
                    )}
                  >
                    {step.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-10 lg:gap-14">
            {STEPS.map((step, i) => {
              const isActive = i === activeIndex;
              const Frame = FRAMES[step.id];
              return (
                <div
                  key={step.id}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="flex min-h-[55vh] flex-col justify-center gap-3 lg:min-h-[65vh]"
                >
                  <div className="lg:hidden">
                    <p className="text-lg font-semibold">{step.title}</p>
                  </div>
                  <Frame key={isActive ? "on" : "off"} isActive={isActive} />
                  <p className="text-center text-sm lg:text-left">{step.long_description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/app/(public)/_components/container";
import {
  AnalyticsFrame,
  CaptureFrame,
  EmailFrame,
  KanbanFrame,
  OrganizeFrame,
} from "@/app/(public)/_components/product-walkthrough-frames";
import { cn } from "@/lib/utils";

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
}

const STEPS: readonly WalkthroughStep[] = [
  {
    id: "capture",
    title: "Zajem strank",
    description: "Prijavna forma na tvoji strani samodejno zabeleži vsako povpraševanje — brez ročnega vnašanja.",
  },
  {
    id: "organize",
    title: "Organizacija leadov",
    description: "Vsaka stranka pristane na enem seznamu — ime, e-pošta, vir in faza na prvi pogled.",
  },
  {
    id: "kanban",
    title: "Kanban pregled",
    description: "Povleci in spusti stranko skozi faze — od povpraševanja do plačljive stranke.",
  },
  {
    id: "email",
    title: "Email avtomatizacije",
    description: "Sistem sam pošilja follow-up sporočila, dokler stranka ne odgovori ali konvertira.",
  },
  {
    id: "analytics",
    title: "Analitika",
    description: "Spremljaj stopnjo konverzije in vir povpraševanj skozi čas.",
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
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Sistem</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          En sistem, od prvega klika do plačljive stranke
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-[380px_1fr] lg:gap-16">
          <div className="hidden lg:sticky lg:top-32 lg:block lg:h-fit">
            <ul className="flex flex-col gap-6">
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
                  <p className="text-center text-sm text-muted-foreground lg:text-left">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

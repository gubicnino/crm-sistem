"use client";

import { motion } from "framer-motion";
import { MessageCircle, Inbox, Kanban, HandCoins } from "lucide-react";
import { Container } from "@/app/(public)/_components/container";
import { Stagger, StaggerItem } from "@/app/(public)/_components/stagger";

const EASE = [0.16, 1, 0.3, 1] as const;

const steps = [
  { icon: MessageCircle, title: "Promet", desc: "Obiskovalci s tvojega Instagrama, TikToka ali spletne strani." },
  { icon: Inbox, title: "Zajem strank", desc: "Prijavna forma in brezplačni vodič zajameta vsako povpraševanje." },
  { icon: Kanban, title: "CRM & Pipeline", desc: "Vsak lead je organiziran in spremljan skozi kanban pregled." },
  { icon: HandCoins, title: "Plačljiva stranka", desc: "Avtomatski follow-up pretvori zanimanje v rezervacijo." },
];

export function Mechanism() {
  return (
    <section id="kako-deluje" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Kako deluje</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Od povpraševanja do stranke, samodejno
        </h2>
        <div className="relative mt-12">
          <motion.div
            aria-hidden="true"
            className="absolute inset-x-6 top-6 hidden h-px origin-left bg-border lg:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1, delay: 0.2, ease: EASE }}
          />
          <Stagger className="grid gap-6 lg:grid-cols-4 lg:gap-4">
            {steps.map((step, i) => (
              <StaggerItem key={step.title} className="flex items-start gap-4 lg:flex-col lg:items-start">
                <motion.div
                  className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  initial={{ scale: 0.5, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.15, ease: EASE }}
                >
                  <step.icon className="size-6" />
                </motion.div>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Container>
    </section>
  );
}

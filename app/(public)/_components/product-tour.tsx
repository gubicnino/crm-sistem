"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { Container } from "@/app/(public)/_components/container";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Real screenshots from the seeded demo account (npm run seed:demo), not
 *  mockups — captured via browser automation from /leads, /pipeline,
 *  /analytics. Re-capture the same way if the dashboard visuals change. */
const TABS = [
  {
    value: "stranke",
    label: "Stranke",
    src: "/images/marketing/dashboard-leads.png",
    alt: "Seznam strank v Trener Growth Sistem CRM",
    caption: "Vse povpraševanja na enem mestu — ime, e-pošta, vir in faza na prvi pogled.",
  },
  {
    value: "pipeline",
    label: "Pipeline",
    src: "/images/marketing/dashboard-pipeline.png",
    alt: "Kanban pregled strank v Trener Growth Sistem CRM",
    caption: "Kanban pregled pokaže natanko, kje je vsaka stranka v prodajnem lijaku.",
  },
  {
    value: "analitika",
    label: "Analitika",
    src: "/images/marketing/dashboard-analytics.png",
    alt: "Analitika pretvorb v Trener Growth Sistem CRM",
    caption: "Spremljaj stopnjo konverzije in lijak po viru povpraševanja skozi čas.",
  },
] as const;

export function ProductTour() {
  const [active, setActive] = useState<string>(TABS[0].value);
  const activeTab = TABS.find((tab) => tab.value === active) ?? TABS[0];

  return (
    <section id="produkt" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Produkt</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Poglej, kako izgleda v praksi
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pravi posnetki zaslona iz delujočega sistema — ne skice ali mockupi.
        </p>

        <Tabs value={active} onValueChange={(value) => setActive(String(value))} className="mt-10 items-center">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative mt-6 overflow-hidden rounded-2xl ring-1 ring-foreground/10 shadow-2xl shadow-foreground/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab.value}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <Image
                src={activeTab.src}
                alt={activeTab.alt}
                width={2886}
                height={1567}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab.value}
            className="mt-4 text-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {activeTab.caption}
          </motion.p>
        </AnimatePresence>
      </Container>
    </section>
  );
}

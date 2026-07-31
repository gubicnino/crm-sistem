"use client";

import { Container } from "@/app/(public)/_components/container";
import { HeroDemo } from "@/app/(public)/_components/hero-demo";
import { MotionPress } from "@/app/(public)/_components/motion-press";
import { Button } from "@/components/ui/button";
import { motion, type Variants } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function Hero() {
  return (
    <section className="flex min-h-screen items-center bg-foreground text-background">
      <Container className="grid w-full gap-10 py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.h1
            variants={item}
            className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Od ogleda do plačljive stranke.
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-xl text-lg text-background/70">
            Trener Growth Sistem je celoten sistem za pridobivanje strank za osebne trenerje in
            online coache: zajame povpraševanja, jih organizira in samodejno spremlja, dokler ne
            postanejo plačljive stranke.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <MotionPress>
              <Button
                size="lg"
                nativeButton={false}
                render={<a href="#kontakt" />}
                className="bg-hot text-white hover:bg-hot/90"
              >
                Pošlji povpraševanje
              </Button>
            </MotionPress>
            <p className="text-sm text-background/60">
              Trenutno sprejemamo omejeno število trenerjev.
            </p>
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
        >
          <HeroDemo />
        </motion.div>
      </Container>
    </section>
  );
}

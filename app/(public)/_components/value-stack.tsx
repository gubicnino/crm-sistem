"use client";

import { Container } from "@/app/(public)/_components/container";
import { Counter } from "@/app/(public)/_components/counter";
import { Stagger, StaggerItem } from "@/app/(public)/_components/stagger";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function ValueStack() {
  return (
    <section className="bg-muted/40 py-20 lg:py-28">
      <Container className="max-w-3xl text-center">
        <Stagger className="grid gap-6 sm:grid-cols-2">
          <StaggerItem className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
            <span className="text-sm text-muted-foreground uppercase">Skupna vrednost</span>
            <p className="relative mt-2 inline-block text-4xl font-semibold text-muted-foreground">
              <Counter to={571} prefix="€" suffix="/mesec" />
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-0.5 origin-left -translate-y-1/2 bg-muted-foreground"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
              />
            </p>
          </StaggerItem>
          <StaggerItem className="rounded-2xl bg-hot/10 p-8 ring-1 ring-hot/20">
            <span className="text-sm text-muted-foreground uppercase">Tvoja cena</span>
            <p className="mt-2 text-4xl font-semibold text-hot">
              <Counter to={199} prefix="€" suffix="/mesec" />
            </p>
          </StaggerItem>
        </Stagger>
        <p className="mt-6 text-sm text-muted-foreground">
          Toliko bi te stalo, če bi vsak del sistema naročil posebej (primerljiva enkratna vrednost: €8.800).
        </p>
      </Container>
    </section>
  );
}

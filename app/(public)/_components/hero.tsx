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
            width={2522}
            height={1567}
            className="h-auto w-full"
            priority
          />
        </div>
      </Container>
    </section>
  );
}

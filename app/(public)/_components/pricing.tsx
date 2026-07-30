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
    <section id="cenik" className="scroll-mt-24 bg-muted/40 py-20 lg:py-28">
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

import { Container } from "@/app/(public)/_components/container";
import { StaggerList, StaggerListItem } from "@/app/(public)/_components/stagger";
import { Check, X } from "lucide-react";

const fitFor = [
  "Imaš stranke in dokazane rezultate, a se to ne pozna na prodaji",
  "Redno objavljaš na Instagramu ali TikToku in imaš promet, ki ga ne izkoristiš",
  "Želiš rezervirati več coaching strank, ne le nabirati všečke",
  "Prodajaš 1:1 treninge ali online programe in želiš delovati profesionalno",
];

const notFitFor = [
  "Šele začenjaš in svoje ponudbe še nisi izoblikoval",
  "Nimaš še dokazanih rezultatov s strankami",
  "Iščeš najcenejšo možno spletno stran, ne sistem za rast",
  "Nočeš sam odgovarjati na povpraševanja strank",
];

export function AudienceFit() {
  return (
    <section className="bg-muted/40 py-20 lg:py-28">
      <Container>
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Za koga je</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Ali je produkt za tebe?
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-success/5 p-8 ring-1 ring-success/20">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success/15 text-success">
              <Check className="size-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">Za tebe, če:</h3>
            <StaggerList className="mt-5 flex flex-col gap-3">
              {fitFor.map((item) => (
                <StaggerListItem key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{item}</span>
                </StaggerListItem>
              ))}
            </StaggerList>
          </div>
          <div className="rounded-2xl bg-muted/30 p-8 ring-1 ring-foreground/10">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <X className="size-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold">Ni zate, če:</h3>
            <StaggerList className="mt-5 flex flex-col gap-3">
              {notFitFor.map((item) => (
                <StaggerListItem key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <span>{item}</span>
                </StaggerListItem>
              ))}
            </StaggerList>
          </div>
        </div>
      </Container>
    </section>
  );
}

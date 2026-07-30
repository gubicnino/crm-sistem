import { Check, X } from "lucide-react";
import { Container } from "@/app/(public)/_components/container";
import { StaggerList, StaggerListItem } from "@/app/(public)/_components/stagger";

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
          <StaggerList className="mt-5 flex flex-col gap-3">
            {fitFor.map((item) => (
              <StaggerListItem key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{item}</span>
              </StaggerListItem>
            ))}
          </StaggerList>
        </div>
        <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
          <h3 className="text-xl font-semibold">Ni zate, če:</h3>
          <StaggerList className="mt-5 flex flex-col gap-3">
            {notFitFor.map((item) => (
              <StaggerListItem key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span>{item}</span>
              </StaggerListItem>
            ))}
          </StaggerList>
        </div>
      </Container>
    </section>
  );
}

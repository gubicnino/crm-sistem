import { Container } from "@/app/(public)/_components/container";

export function ValueStack() {
  return (
    <section className="bg-muted/40 py-20 lg:py-28">
      <Container className="max-w-3xl text-center">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-card p-8 ring-1 ring-foreground/10">
            <span className="text-sm text-muted-foreground uppercase">Skupna vrednost</span>
            <p className="mt-2 text-4xl font-semibold text-muted-foreground line-through">
              €571/mesec
            </p>
          </div>
          <div className="rounded-2xl bg-hot/10 p-8 ring-1 ring-hot/20">
            <span className="text-sm text-muted-foreground uppercase">Tvoja cena</span>
            <p className="mt-2 text-4xl font-semibold text-hot">€199/mesec</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Toliko bi te stalo, če bi vsak del sistema naročil posebej — ločena spletna stran, CRM
          orodje, obrazci in email avtomatizacija. Pri nas dobiš vse skupaj v enem, brez enkratnega
          stroška razvoja (primerljiva enkratna vrednost: €8.800).
        </p>
      </Container>
    </section>
  );
}

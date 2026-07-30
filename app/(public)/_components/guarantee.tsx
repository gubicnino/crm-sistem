import { Container } from "@/app/(public)/_components/container";

export function Guarantee() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="flex max-w-3xl flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-full bg-primary/10 text-center text-primary">
          <span className="text-xs font-semibold">1 MESEC</span>
          <span className="text-xs font-semibold">BREZPLAČNO</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Brez tveganja</h2>
          <p className="mt-2 text-muted-foreground">
            Prvih 5 trenerjev, ki se pridružijo, dobi cel prvi mesec brezplačno. In ker verjameva v
            sistem, lahko kadarkoli odpoveš — brez vezave, brez skritih pogojev.
          </p>
        </div>
      </Container>
    </section>
  );
}

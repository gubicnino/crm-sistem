import { Gift, ShieldCheck, Unlock } from "lucide-react";
import { Container } from "@/app/(public)/_components/container";
import { Stagger, StaggerItem } from "@/app/(public)/_components/stagger";

export function Guarantee() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl bg-hot/5 p-10 ring-1 ring-hot/20 sm:p-14">
          <div className="absolute -top-24 -right-24 size-64 rounded-full bg-hot/10 blur-3xl" aria-hidden />
          <Stagger className="relative flex flex-col items-center text-center">
            <StaggerItem className="flex size-14 items-center justify-center rounded-2xl bg-hot/15 text-hot">
              <ShieldCheck className="size-7" />
            </StaggerItem>
            <StaggerItem>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">Brez tveganja</h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Verjameva v sistem, zato tveganje prevzameva namesto tebe.
              </p>
            </StaggerItem>
            <Stagger className="mt-8 grid w-full gap-4 sm:grid-cols-2">
              <StaggerItem className="flex items-center gap-3 rounded-2xl bg-card p-5 text-left ring-1 ring-foreground/10">
                <Gift className="size-6 shrink-0 text-hot" />
                <div>
                  <p className="font-semibold">1 mesec brezplačno</p>
                  <p className="text-sm text-muted-foreground">Za prvih 5 trenerjev, ki se pridružijo.</p>
                </div>
              </StaggerItem>
              <StaggerItem className="flex items-center gap-3 rounded-2xl bg-card p-5 text-left ring-1 ring-foreground/10">
                <Unlock className="size-6 shrink-0 text-hot" />
                <div>
                  <p className="font-semibold">Brez vezave</p>
                  <p className="text-sm text-muted-foreground">Odpoveš lahko kadarkoli, brez skritih pogojev.</p>
                </div>
              </StaggerItem>
            </Stagger>
          </Stagger>
        </div>
      </Container>
    </section>
  );
}

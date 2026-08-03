import { Button } from "@/components/ui/button";
import { Container } from "@/app/(public)/_components/container";
import { MotionPress } from "@/app/(public)/_components/motion-press";
import { Stagger, StaggerItem } from "@/app/(public)/_components/stagger";

export function Cta() {
  return (
    <section id="cenik" className="scroll-mt-24 py-20 lg:py-28">
      <Container className="max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-14 text-center text-background sm:px-14">
          <div className="absolute -top-24 -right-24 size-64 rounded-full bg-hot/20 blur-3xl" aria-hidden />
          <Stagger className="relative flex flex-col items-center">
            <StaggerItem>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pripravljen na več strank?
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 max-w-xl text-background/70">
                Povej nam nekaj o svoji ponudbi in se v 24 urah oglasimo s predlogom, kako lahko
                sistem deluje zate.
              </p>
            </StaggerItem>
            <StaggerItem>
              <MotionPress className="mt-8">
                <Button
                  size="xl"
                  nativeButton={false}
                  render={<a href="#kontakt" />}
                  className="bg-hot text-white hover:bg-hot/90"
                >
                  Pošlji povpraševanje
                </Button>
              </MotionPress>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 text-sm text-background/50">
                Trenutno sprejemamo omejeno število trenerjev · brez vezave
              </p>
            </StaggerItem>
          </Stagger>
        </div>
      </Container>
    </section>
  );
}

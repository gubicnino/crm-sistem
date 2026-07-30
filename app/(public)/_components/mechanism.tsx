import { ArrowRight, MessageCircle, Inbox, Kanban, HandCoins } from "lucide-react";
import { Container } from "@/app/(public)/_components/container";

const steps = [
  { icon: MessageCircle, title: "Promet", desc: "Obiskovalci s tvojega Instagrama, TikToka ali spletne strani." },
  { icon: Inbox, title: "Zajem strank", desc: "Prijavna forma in brezplačni vodič zajameta vsako povpraševanje." },
  { icon: Kanban, title: "CRM & Pipeline", desc: "Vsak lead je organiziran in spremljan skozi kanban pregled." },
  { icon: HandCoins, title: "Plačljiva stranka", desc: "Avtomatski follow-up pretvori zanimanje v rezervacijo." },
];

export function Mechanism() {
  return (
    <section id="kako-deluje" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Kako deluje</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Od povpraševanja do stranke, samodejno
        </h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-4 lg:gap-4">
          {steps.map((step, i) => (
            <div key={step.title} className="flex items-start gap-4 lg:flex-col lg:items-start">
              <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="size-6" />
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden size-5 text-muted-foreground lg:hidden" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

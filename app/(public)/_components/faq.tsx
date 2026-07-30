import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/app/(public)/_components/container";

const faqs = [
  {
    q: "Ali potrebujem tehnično znanje za uporabo sistema?",
    a: "Ne. Sistem upravljaš iz enostavne nadzorne plošče, vso tehnično postavitev in vzdrževanje prevzamemo mi.",
  },
  {
    q: "Že imam spletno stran — ali jo moram zamenjati?",
    a: "Ne nujno — obstoječo stran lahko povežemo z zajemom strank, ali pa ti v okviru paketa pripravimo novo, prodajno usmerjeno stran.",
  },
  {
    q: "Kako hitro lahko začnem?",
    a: "Po uvodnem klicu je sistem prilagojen tvoji ponudbi in pripravljen za uporabo v nekaj dneh.",
  },
  {
    q: "Kaj se zgodi, če odpovem?",
    a: "Naročnino lahko kadarkoli prekineš, brez vezave in brez dodatnih stroškov.",
  },
];

export function Faq() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-3xl">
        <span className="text-sm font-medium tracking-wide text-hot uppercase">FAQ</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pogosta vprašanja
        </h2>
        <Accordion className="mt-10">
          {faqs.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i + 1}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}

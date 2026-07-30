import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/app/(public)/_components/container";

const bonuses = [
  {
    title: "Sistem za zajem strank",
    value: "€29/mesec",
    what: "Prijavna forma za trenerstvo s prilagojenimi vprašanji za vsakega trenerja, ločena lead magnet forma za brezplačni vodič, samodejno ločevanje glede na vir prijave.",
    how: "Dobiš tople leade (samo email) in vroče leade (izpolnjena prijava) ločeno označene, zato lahko svoj čas najprej nameniš tistim, ki so najbližje nakupu.",
  },
  {
    title: "Center za upravljanje strank",
    value: "€49/mesec",
    what: "Centralna baza, kjer je vsak kontakt označen glede na vir, pri prijavah pa so vidni tudi odgovori na tvoja lastna vprašanja.",
    how: "Takoj vidiš, kdo je resno izpolnil prijavo in kaj je odgovoril — brez brskanja po Instagram sporočilih ali beleženja na roko.",
  },
  {
    title: "Pipeline za vodenje potencialnih strank",
    value: "€29/mesec",
    what: "Kanban tabla s fazami od prvega stika do stranke: Email → Izpolnjena forma → V kontaktu → Stranka.",
    how: "Vidiš ne le koliko leadov imaš, ampak tudi kako daleč so v procesu, in jih premikaš sam — brez nepotrebnega iskanja po sporočilih.",
  },
  {
    title: "Avtomatski follow-up sistem",
    value: "€39/mesec",
    what: "Dve ločeni email sekvenci — ena za email leade (vodič in izobraževalne vsebine), druga za prijave za trenerstvo (takojšnja potrditev in poziv k rezervaciji klica).",
    how: "Hladni leadi se postopoma segrevajo, resni kandidati pa dobijo takojšen odziv takrat, ko je njihovo zanimanje najvišje.",
  },
  {
    title: "Tvoja ponudbena strategija",
    value: "€49/mesec",
    what: "Skupaj oblikujeva jasno sporočilo o tem, komu pomagaš in zakaj prav tebi zaupati.",
    how: "Ta okvir uporabiš na spletni strani, v formah in v follow-up sporočilih, tako da je komunikacija enotna in bolj prepričljiva povsod hkrati.",
  },
  {
    title: "Analitično središče",
    value: "€29/mesec",
    what: "Pregled, koliko email leadov se dejansko pretvori v prijave in naprej v plačljive stranke.",
    how: "Vidiš, ali ti brezplačni vodič sploh prinaša prave kandidate, in imaš podatke za optimizacijo svojega sistema.",
  },
  {
    title: "Sistem neprekinjene optimizacije",
    value: "€99/mesec",
    what: "Mesečne posodobitve, manjši popravki in tehnična podpora za celoten sistem.",
    how: "Ni ti treba skrbeti za tehnične težave — sistem teče naprej v ozadju, brez tvojega vpletanja.",
  },
  {
    title: "Osebni zagon sistema",
    value: "€149/mesec",
    what: "20-minutni onboarding klic, kjer skupaj nastaviva tvoja prijavna vprašanja, in osebna podpora skozi celotno uporabo sistema.",
    how: "Odstrani največje tveganje pri novi naročnini — da jo kupiš, se izgubiš v uporabi in odpoveš, še preden vidiš rezultat.",
  },
];

export function BonusStack() {
  return (
    <section className="py-20 lg:py-28">
      <Container className="max-w-3xl">
        <span className="text-sm font-medium tracking-wide text-hot uppercase">Bonusi</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Kaj vse dobiš zraven
        </h2>
        <Accordion className="mt-10">
          {bonuses.map((bonus, i) => (
            <AccordionItem key={bonus.title} value={`bonus-${i + 1}`}>
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between pr-4 text-left">
                  <span>
                    Bonus #{i + 1} — {bonus.title}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground line-through">
                    {bonus.value}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Kaj je to: </span>
                  {bonus.what}
                </p>
                <p>
                  <span className="font-medium text-foreground">Kako pomaga: </span>
                  {bonus.how}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}

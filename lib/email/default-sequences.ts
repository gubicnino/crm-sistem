import type { LeadSource } from "@/db/schema";
import type { EmailDocNode } from "@/db/types";
import { headingAndParagraphsToDoc } from "@/lib/email/plain-text-to-doc";

export interface DefaultSequenceStep {
  dayOffset: number;
  subject: string;
  body: EmailDocNode;
}

export interface DefaultSequence {
  name: string;
  triggerSource: LeadSource;
  steps: DefaultSequenceStep[];
}

interface RawDefaultStep {
  dayOffset: number;
  subject: string;
  heading: string;
  paragraphs: string[];
}

interface RawDefaultSequence {
  name: string;
  triggerSource: LeadSource;
  steps: RawDefaultStep[];
}

/**
 * Starter content every new trainer gets (see lib/email/seed-defaults.ts),
 * ported from the pre-Phase-1 hardcoded lib/email/sequences.ts +
 * lib/email/copy.ts — same two sequences, same steps, same day offsets.
 * Authored in this plain heading+paragraphs shape for readability, then
 * converted to a rich-text `body` (headingAndParagraphsToDoc) below —
 * `${ctx.trainerName}` interpolations become the literal `{{trener}}`
 * token, converted to a `variable` node by that same helper. The old
 * name-conditional headings ("Hvala, Ana!" vs. "Hvala!") are flattened to a
 * single unconditional heading, since substitution has no branching — the
 * trainer is expected to edit this starter copy to fit their voice.
 */
const RAW_DEFAULT_SEQUENCES: RawDefaultSequence[] = [
  {
    name: "Prijave",
    triggerSource: "application",
    steps: [
      {
        dayOffset: 0,
        subject: "Prejeli smo vašo prijavo",
        heading: "Hvala za prijavo!",
        paragraphs: [
          "Vašo prijavo smo uspešno prejeli. {{trener}} si jo bo kmalu ogledal in vas kontaktiral.",
          "V naslednjem sporočilu vas čaka povezava za rezervacijo termina za klic.",
        ],
      },
      {
        dayOffset: 0,
        subject: "Rezervirajte termin za klic",
        heading: "Rezervirajte termin za klic",
        paragraphs: [
          "{{trener}} bi se rad z vami slišal in spoznal vaše cilje.",
          "Odgovorite na to sporočilo ali nas pokličite, da dogovorimo termin.",
        ],
      },
      {
        dayOffset: 2,
        subject: "Še vedno vas zanima?",
        heading: "Še vedno vas zanima?",
        paragraphs: [
          "Preteklo je nekaj dni od vaše prijave in {{trener}} vas še vedno rad sliši.",
          "Če vas zanima nadaljevanje, se javite — z veseljem odgovorimo na vsa vprašanja.",
        ],
      },
      {
        dayOffset: 5,
        subject: "Zadnja priložnost za termin",
        heading: "Zadnja priložnost za termin",
        paragraphs: [
          "To je zadnje opozorilo iz naše prijavne sekvence. {{trener}} bi rad slišal od vas.",
          "Če je čas neprimeren, ni problema — vedno se lahko oglasite kasneje.",
        ],
      },
    ],
  },
  {
    name: "Brezplačni vodič",
    triggerSource: "lead_magnet",
    steps: [
      {
        dayOffset: 0,
        subject: "Vaš brezplačni vodič",
        heading: "Tukaj je vaš brezplačni vodič",
        paragraphs: [
          "Hvala za vaš interes! {{trener}} vam je pripravil brezplačni vodič — najdete ga na povezavi spodaj.",
          "V naslednjih dneh boste prejeli še nekaj koristnih nasvetov.",
        ],
      },
      {
        dayOffset: 2,
        subject: "Kako začeti",
        heading: "Kako začeti",
        paragraphs: [
          "Najpogostejša napaka na začetku je, da hočemo narediti preveč naenkrat.",
          "Majhni, dosledni koraki prinesejo boljše rezultate kot popoln načrt, ki ga ne vzdržimo.",
        ],
      },
      {
        dayOffset: 5,
        subject: "Pogosta napaka pri treniranju",
        heading: "Pogosta napaka pri treniranju",
        paragraphs: [
          "Veliko ljudi preneha, ker pričakuje prehitre rezultate.",
          "Napredek se najbolje meri čez tedne, ne dneve.",
        ],
      },
      {
        dayOffset: 9,
        subject: "Doslednost je pomembnejša od popolnosti",
        heading: "Doslednost je pomembnejša od popolnosti",
        paragraphs: [
          "Ni vam treba biti popolni vsak dan — dovolj je, da se držite načrta večino časa.",
          "Če želite osebno vodstvo pri tem, smo tu.",
        ],
      },
      {
        dayOffset: 14,
        subject: "Pripravljeni na naslednji korak?",
        heading: "Pripravljeni na naslednji korak?",
        paragraphs: [
          "Če razmišljate o osebnem vodstvu, se {{trener}} z veseljem pogovori z vami.",
          "Odgovorite na to sporočilo, da se dogovorimo za kratek klic.",
        ],
      },
    ],
  },
];

export const DEFAULT_SEQUENCES: DefaultSequence[] = RAW_DEFAULT_SEQUENCES.map((sequence) => ({
  name: sequence.name,
  triggerSource: sequence.triggerSource,
  steps: sequence.steps.map((step) => ({
    dayOffset: step.dayOffset,
    subject: step.subject,
    body: headingAndParagraphsToDoc(step.heading, step.paragraphs),
  })),
}));

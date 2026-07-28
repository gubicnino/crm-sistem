import type { SequenceContext, TemplateKey } from "@/lib/email/sequences";

export interface EmailCopy {
  heading: string;
  paragraphs: string[];
}

/**
 * Slovenian body copy per template. TODO: copy review — this is placeholder
 * text, written to be genuinely sendable and structurally correct, not final
 * marketing copy. TypeScript enforces an entry for every TemplateKey, so
 * adding a sequence step without adding its copy is a compile error.
 */
export const COPY: Record<TemplateKey, (ctx: SequenceContext) => EmailCopy> = {
  application_confirmation: (ctx) => ({
    heading: ctx.leadName ? `Hvala za prijavo, ${ctx.leadName}!` : "Hvala za prijavo!",
    paragraphs: [
      `Vašo prijavo smo uspešno prejeli. ${ctx.trainerName} si jo bo kmalu ogledal in vas kontaktiral.`,
      "V naslednjem sporočilu vas čaka povezava za rezervacijo termina za klic.",
    ],
  }),
  application_booking_prompt: (ctx) => ({
    heading: "Rezervirajte termin za klic",
    paragraphs: [
      `${ctx.trainerName} bi se rad z vami slišal in spoznal vaše cilje.`,
      "Odgovorite na to sporočilo ali nas pokličite, da dogovorimo termin.",
    ],
  }),
  application_followup_2: (ctx) => ({
    heading: "Še vedno vas zanima?",
    paragraphs: [
      `Preteklo je nekaj dni od vaše prijave in ${ctx.trainerName} vas še vedno rad sliši.`,
      "Če vas zanima nadaljevanje, se javite — z veseljem odgovorimo na vsa vprašanja.",
    ],
  }),
  application_followup_5: (ctx) => ({
    heading: "Zadnja priložnost za termin",
    paragraphs: [
      `To je zadnje opozorilo iz naše prijavne sekvence. ${ctx.trainerName} bi rad slišal od vas.`,
      "Če je čas neprimeren, ni problema — vedno se lahko oglasite kasneje.",
    ],
  }),
  lead_magnet_guide: (ctx) => ({
    heading: ctx.leadName ? `Tukaj je vaš vodič, ${ctx.leadName}` : "Tukaj je vaš brezplačni vodič",
    paragraphs: [
      `Hvala za vaš interes! ${ctx.trainerName} vam je pripravil brezplačni vodič — najdete ga na povezavi spodaj.`,
      "V naslednjih dneh boste prejeli še nekaj koristnih nasvetov.",
    ],
  }),
  lead_magnet_edu_2: () => ({
    heading: "Kako začeti",
    paragraphs: [
      "Najpogostejša napaka na začetku je, da hočemo narediti preveč naenkrat.",
      "Majhni, dosledni koraki prinesejo boljše rezultate kot popoln načrt, ki ga ne vzdržimo.",
    ],
  }),
  lead_magnet_edu_5: () => ({
    heading: "Pogosta napaka pri treniranju",
    paragraphs: [
      "Veliko ljudi preneha, ker pričakuje prehitre rezultate.",
      "Napredek se najbolje meri čez tedne, ne dneve.",
    ],
  }),
  lead_magnet_edu_9: () => ({
    heading: "Doslednost je pomembnejša od popolnosti",
    paragraphs: [
      "Ni vam treba biti popolni vsak dan — dovolj je, da se držite načrta večino časa.",
      "Če želite osebno vodstvo pri tem, smo tu.",
    ],
  }),
  lead_magnet_edu_14: (ctx) => ({
    heading: "Pripravljeni na naslednji korak?",
    paragraphs: [
      `Če razmišljate o osebnem vodstvu, se ${ctx.trainerName} z veseljem pogovori z vami.`,
      "Odgovorite na to sporočilo, da se dogovorimo za kratek klic.",
    ],
  }),
};

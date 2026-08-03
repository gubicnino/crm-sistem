import { config } from "dotenv";

// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

const DEMO_EMAIL = "demo@trener-growth.si";
const DEMO_PASSWORD = "Demo1234!";
const DEMO_NAME = "Janez Novak";

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { users, leads, notes } = await import("../db/schema");
  const { createUserAndTrainer } = await import("../db/queries/auth");
  const { updateApplicationQuestions } = await import("../db/queries/trainers");
  const { seedDefaultSequencesForTrainer } = await import("../lib/email/seed-defaults");
  const { mintInvite } = await import("../lib/invites");
  const { hashPassword } = await import("../lib/password");
  const { generateSiteKey } = await import("../lib/site-key");
  const { systemScope } = await import("../lib/tenant");
  type LeadSource = "application" | "lead_magnet";
  type PipelineStage = "email_lead" | "application_received" | "contacted" | "client" | "lost";
  type LeadAnswers = Record<string, string>;

  // Re-runnable: wipe any previous demo account first (cascades to trainer,
  // leads, notes, scheduled_emails).
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) {
    await db.delete(users).where(eq(users.id, existing.id));
    console.log("Removed previous demo account.");
  }

  const { invite } = await mintInvite(DEMO_EMAIL);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const { trainer } = await createUserAndTrainer({
    email: DEMO_EMAIL,
    passwordHash,
    name: DEMO_NAME,
    siteKey: generateSiteKey(DEMO_NAME),
    inviteId: invite.id,
  });
  const scope = systemScope(trainer.id, "cron_daily");

  await updateApplicationQuestions(scope, [
    { id: "goal", label: "Kakšen je tvoj cilj?", type: "text", required: true },
    {
      id: "experience",
      label: "Koliko časa že treniraš?",
      type: "select",
      required: false,
      options: ["Manj kot leto", "1-3 leta", "Več kot 3 leta"],
    },
    { id: "availability", label: "Kdaj si na voljo za treninge?", type: "text", required: false },
    {
      id: "injuries",
      label: "Imaš kakšne poškodbe ali zdravstvene omejitve?",
      type: "textarea",
      required: false,
    },
    {
      id: "location",
      label: "Kje bi rad treniral?",
      type: "select",
      required: false,
      options: ["V fitnesu", "Na prostem", "Doma"],
    },
    {
      id: "newsletter",
      label: "Se želiš prijaviti na e-novice z nasveti za trening?",
      type: "checkbox",
      required: false,
    },
  ]);

  await seedDefaultSequencesForTrainer(scope);

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

  const seedLeads: {
    name: string;
    email: string;
    source: LeadSource;
    stage: PipelineStage;
    createdAt: Date;
    stageChangedAt: Date;
    answers: LeadAnswers | null;
  }[] = [
    {
      name: "Ana Kovač",
      email: "ana.kovac@example.com",
      source: "application" as const,
      stage: "application_received" as const,
      createdAt: daysAgo(1),
      stageChangedAt: daysAgo(1),
      answers: {
        goal: "Shujšati 5 kg",
        experience: "Manj kot leto",
        availability: "Ponedeljek in sreda zvečer",
        injuries: "Blaga bolečina v kolenu, brez omejitev za hojo",
        location: "V fitnesu",
        newsletter: "Da",
      },
    },
    {
      name: "Marko Zupančič",
      email: "marko.zupancic@example.com",
      source: "application" as const,
      stage: "contacted" as const,
      createdAt: daysAgo(4),
      stageChangedAt: daysAgo(2),
      answers: { goal: "Pridobiti mišično maso", experience: "1-3 leta", availability: "Zvečer po 18h" },
    },
    {
      name: "Nina Horvat",
      email: "nina.horvat@example.com",
      source: "application" as const,
      stage: "contacted" as const,
      createdAt: daysAgo(3),
      stageChangedAt: daysAgo(1),
      answers: { goal: "Splošna kondicija", experience: "Več kot 3 leta" },
    },
    {
      // Stuck: contacted threshold is 5 days (lib/pipeline.ts) — this one is at 8.
      name: "Luka Kranjc",
      email: "luka.kranjc@example.com",
      source: "application" as const,
      stage: "contacted" as const,
      createdAt: daysAgo(12),
      stageChangedAt: daysAgo(8),
      answers: { goal: "Priprava na maraton", experience: "1-3 leta" },
    },
    {
      name: "Petra Vidmar",
      email: "petra.vidmar@example.com",
      source: "application" as const,
      stage: "client" as const,
      createdAt: daysAgo(20),
      stageChangedAt: daysAgo(14),
      answers: { goal: "Shujšati 10 kg", experience: "Manj kot leto" },
    },
    {
      name: "Rok Potočnik",
      email: "rok.potocnik@example.com",
      source: "application" as const,
      stage: "lost" as const,
      createdAt: daysAgo(25),
      stageChangedAt: daysAgo(18),
      answers: { goal: "Rehabilitacija po poškodbi" },
    },
    {
      name: "Sara Golob",
      email: "sara.golob@example.com",
      source: "lead_magnet" as const,
      stage: "email_lead" as const,
      createdAt: daysAgo(0),
      stageChangedAt: daysAgo(0),
      answers: null,
    },
    {
      name: "Tim Kos",
      email: "tim.kos@example.com",
      source: "lead_magnet" as const,
      stage: "email_lead" as const,
      createdAt: daysAgo(2),
      stageChangedAt: daysAgo(2),
      answers: null,
    },
    {
      // Stuck: contacted threshold is 5 days — this one is at 6. Also carries
      // an answer key ("legacy_question") not in the current question set,
      // to showcase the "archived answers" section on the lead detail page.
      name: "Eva Zupan",
      email: "eva.zupan@example.com",
      source: "application" as const,
      stage: "contacted" as const,
      createdAt: daysAgo(9),
      stageChangedAt: daysAgo(6),
      answers: { goal: "Izboljšati moč", experience: "Več kot 3 leta", legacy_question: "Star odgovor iz prejšnjega obrazca" },
    },
    {
      name: "Jan Božič",
      email: "jan.bozic@example.com",
      source: "lead_magnet" as const,
      stage: "client" as const,
      createdAt: daysAgo(30),
      stageChangedAt: daysAgo(10),
      answers: null,
    },
    {
      name: "Maja Turk",
      email: "maja.turk@example.com",
      source: "application" as const,
      stage: "application_received" as const,
      createdAt: daysAgo(0),
      stageChangedAt: daysAgo(0),
      answers: { goal: "Priprava na poletje" },
    },
    {
      name: "David Kovačič",
      email: "david.kovacic@example.com",
      source: "application" as const,
      stage: "lost" as const,
      createdAt: daysAgo(15),
      stageChangedAt: daysAgo(11),
      answers: { goal: "Splošna vzdržljivost" },
    },
  ];

  const insertedLeads: Record<string, string> = {};
  for (const lead of seedLeads) {
    const [row] = await db.insert(leads).values({ trainerId: trainer.id, ...lead }).returning({ id: leads.id });
    insertedLeads[lead.email] = row.id;
  }

  await db.insert(notes).values([
    {
      trainerId: trainer.id,
      leadId: insertedLeads["marko.zupancic@example.com"],
      body: "Poklican v torek, zanima ga paket 3x tedensko.",
    },
    {
      trainerId: trainer.id,
      leadId: insertedLeads["petra.vidmar@example.com"],
      body: "Podpisala 6-mesečni paket. Prvi trening v ponedeljek.",
    },
    {
      trainerId: trainer.id,
      leadId: insertedLeads["jan.bozic@example.com"],
      body: "Prestopil iz brezplačnega vodiča v plačljiv paket po 3 tednih dopisovanja.",
    },
  ]);

  console.log("\nDemo account ready:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Site key: ${trainer.siteKey}`);
  console.log(`  Leads:    ${seedLeads.length} (across all stages and both sources)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import { QuestionsEditor } from "@/components/settings/questions-editor";
import { SiteKeyCard } from "@/components/settings/site-key-card";
import { getTrainer } from "@/db/queries/trainers";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function SettingsPage() {
  const scope = await requireTrainer();
  const trainer = await getTrainer(scope);
  if (!trainer) return null; // requireTrainer() already guarantees a trainer row exists

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{sl.settings.title}</h1>
      <SiteKeyCard siteKey={trainer.siteKey} />
      <QuestionsEditor initialQuestions={trainer.applicationQuestions} />
    </div>
  );
}

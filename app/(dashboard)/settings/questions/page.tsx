import { PageHeader } from "@/components/dashboard/page-header";
import { QuestionsEditor } from "@/components/settings/questions-editor";
import { getTrainer } from "@/db/queries/trainers";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function SettingsQuestionsPage() {
  const scope = await requireTrainer();
  const trainer = await getTrainer(scope);
  if (!trainer) return null; // requireTrainer() already guarantees a trainer row exists

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.settings.questionsTitle} />
      <QuestionsEditor initialQuestions={trainer.applicationQuestions} />
    </div>
  );
}

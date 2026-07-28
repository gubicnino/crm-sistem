import { QuestionsEditor } from "@/components/settings/questions-editor";
import { getTrainer } from "@/db/queries/trainers";
import { requireTrainer } from "@/lib/tenant";

export default async function SettingsQuestionsPage() {
  const scope = await requireTrainer();
  const trainer = await getTrainer(scope);
  if (!trainer) return null; // requireTrainer() already guarantees a trainer row exists

  return <QuestionsEditor initialQuestions={trainer.applicationQuestions} />;
}

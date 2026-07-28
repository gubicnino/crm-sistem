import Link from "next/link";
import { AnswersView } from "@/components/leads/answers-view";
import { listLeads } from "@/db/queries/leads";
import { getTrainer } from "@/db/queries/trainers";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function ApplicationsPage() {
  const scope = await requireTrainer();
  const [applications, trainer] = await Promise.all([
    listLeads(scope, { source: "application" }),
    getTrainer(scope),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{sl.applications.title}</h1>
      {applications.length === 0 ? (
        <p className="text-muted-foreground">{sl.applications.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {applications.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                  {lead.name ?? lead.email}
                </Link>
                <span className="text-sm text-muted-foreground">{pipelineStageLabels[lead.stage]}</span>
              </div>
              <AnswersView answers={lead.answers} questions={trainer?.applicationQuestions ?? []} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { PageHeader } from "@/components/dashboard/page-header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { listLeads } from "@/db/queries/leads";
import { pipelineStageEnum, type Lead, type PipelineStage } from "@/db/schema";
import { getTrainer } from "@/db/queries/trainers";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function PipelinePage() {
  const scope = await requireTrainer();
  const [leads, trainer] = await Promise.all([listLeads(scope), getTrainer(scope)]);

  const grouped = Object.fromEntries(pipelineStageEnum.enumValues.map((stage) => [stage, [] as Lead[]])) as Record<
    PipelineStage,
    Lead[]
  >;
  for (const lead of leads) {
    grouped[lead.stage].push(lead);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.pipeline.title} />
      <KanbanBoard initialGrouped={grouped} initialStageLabels={trainer?.stageLabels ?? pipelineStageLabels} />
    </div>
  );
}

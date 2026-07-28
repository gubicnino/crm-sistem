import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { listLeads } from "@/db/queries/leads";
import { pipelineStageEnum, type Lead, type PipelineStage } from "@/db/schema";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function PipelinePage() {
  const scope = await requireTrainer();
  const leads = await listLeads(scope);

  const grouped = Object.fromEntries(pipelineStageEnum.enumValues.map((stage) => [stage, [] as Lead[]])) as Record<
    PipelineStage,
    Lead[]
  >;
  for (const lead of leads) {
    grouped[lead.stage].push(lead);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{sl.pipeline.title}</h1>
      <KanbanBoard initialGrouped={grouped} />
    </div>
  );
}

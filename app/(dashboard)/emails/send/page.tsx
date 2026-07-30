import Link from "next/link";
import { BroadcastForm } from "@/components/emails/broadcast-form";
import { LeadFilters } from "@/components/leads/lead-filters";
import { SourceFilterChips } from "@/components/leads/source-filter-chips";
import { Button } from "@/components/ui/button";
import { listLeads } from "@/db/queries/leads";
import { leadSourceEnum, pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";
import { isTerminalStage } from "@/lib/pipeline";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

function isValidStage(value: string | undefined): value is PipelineStage {
  return !!value && (pipelineStageEnum.enumValues as readonly string[]).includes(value);
}

function isValidSource(value: string | undefined): value is LeadSource {
  return !!value && (leadSourceEnum.enumValues as readonly string[]).includes(value);
}

export default async function SendBroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; source?: string }>;
}) {
  const scope = await requireTrainer();
  const params = await searchParams;
  const stage = isValidStage(params.stage) ? params.stage : undefined;
  const source = isValidSource(params.source) ? params.source : undefined;

  const leads = await listLeads(scope, { stage, source });
  // Not selectable even in this list — sendBroadcast excludes them again
  // server-side regardless, but there's no point offering an unusable choice.
  const eligibleLeads = leads.filter((lead) => !lead.unsubscribedAt && !isTerminalStage(lead.stage));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sendTitle}</h1>
        <Button variant="outline" size="sm" render={<Link href="/emails" />}>
          {sl.emails.sendBackToEmails}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <LeadFilters currentStage={stage} />
        <SourceFilterChips current={source} />
      </div>
      <BroadcastForm leads={eligibleLeads} />
    </div>
  );
}

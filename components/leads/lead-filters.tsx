"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pipelineStageEnum, type PipelineStage } from "@/db/schema";
import { sl } from "@/lib/strings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/** Source filtering lives in components/leads/source-filter-chips.tsx — this
 *  component only owns the stage filter (per the mockup's chips + select split). */
export function LeadFilters({
  currentStage,
  stageLabels,
}: {
  currentStage?: PipelineStage;
  stageLabels: Record<PipelineStage, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStage(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete("stage");
    } else {
      params.set("stage", value);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select value={currentStage ?? ALL} onValueChange={setStage}>
      <SelectTrigger size="sm" aria-label={sl.leads.stageLabel}>
        <SelectValue>{(value: string) => (value === ALL ? sl.leads.filterAllStages : stageLabels[value as PipelineStage])}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{sl.leads.filterAllStages}</SelectItem>
        {pipelineStageEnum.enumValues.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {stageLabels[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

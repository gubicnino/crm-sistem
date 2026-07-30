"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { pipelineStageEnum, type PipelineStage } from "@/db/schema";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/** Source filtering lives in components/leads/source-filter-chips.tsx — this
 *  component only owns the stage filter (per the mockup's chips + select split). */
export function LeadFilters({ currentStage }: { currentStage?: PipelineStage }) {
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
        <SelectValue>
          {(value: string) =>
            value === ALL ? sl.leads.filterAllStages : pipelineStageLabels[value as PipelineStage]
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{sl.leads.filterAllStages}</SelectItem>
        {pipelineStageEnum.enumValues.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {pipelineStageLabels[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

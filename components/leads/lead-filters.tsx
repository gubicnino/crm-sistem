"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { leadSourceEnum, pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

export function LeadFilters({
  currentStage,
  currentSource,
}: {
  currentStage?: PipelineStage;
  currentSource?: LeadSource;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: "stage" | "source", value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex gap-2">
      <Select value={currentStage ?? ALL} onValueChange={(value) => setParam("stage", value)}>
        <SelectTrigger size="sm">
          <SelectValue placeholder={sl.leads.filterAllStages} />
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
      <Select value={currentSource ?? ALL} onValueChange={(value) => setParam("source", value)}>
        <SelectTrigger size="sm">
          <SelectValue placeholder={sl.leads.filterAllSources} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{sl.leads.filterAllSources}</SelectItem>
          {leadSourceEnum.enumValues.map((source) => (
            <SelectItem key={source} value={source}>
              {leadSourceLabels[source]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

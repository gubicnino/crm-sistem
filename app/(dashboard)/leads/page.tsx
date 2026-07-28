import Link from "next/link";
import { listLeads } from "@/db/queries/leads";
import { leadSourceEnum, pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";
import { LeadFilters } from "@/components/leads/lead-filters";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

function isValidStage(value: string | undefined): value is PipelineStage {
  return !!value && (pipelineStageEnum.enumValues as readonly string[]).includes(value);
}

function isValidSource(value: string | undefined): value is LeadSource {
  return !!value && (leadSourceEnum.enumValues as readonly string[]).includes(value);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; source?: string }>;
}) {
  const scope = await requireTrainer();
  const params = await searchParams;
  const stage = isValidStage(params.stage) ? params.stage : undefined;
  const source = isValidSource(params.source) ? params.source : undefined;

  const leads = await listLeads(scope, { stage, source });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.leads.title}</h1>
        <LeadFilters currentStage={stage} currentSource={source} />
      </div>

      {leads.length === 0 ? (
        <p className="text-muted-foreground">{sl.leads.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{sl.leads.columnName}</TableHead>
              <TableHead>{sl.leads.columnEmail}</TableHead>
              <TableHead>{sl.leads.columnStage}</TableHead>
              <TableHead>{sl.leads.columnSource}</TableHead>
              <TableHead>{sl.leads.columnCreated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.name ?? lead.email}
                  </Link>
                </TableCell>
                <TableCell>{lead.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{pipelineStageLabels[lead.stage]}</Badge>
                </TableCell>
                <TableCell>{leadSourceLabels[lead.source]}</TableCell>
                <TableCell>{lead.createdAt.toLocaleDateString("sl-SI")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

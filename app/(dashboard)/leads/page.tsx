import Link from "next/link";
import { listLeadsPaged } from "@/db/queries/leads";
import { leadSourceEnum, pipelineStageEnum, type LeadSource, type PipelineStage } from "@/db/schema";
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadSearch } from "@/components/leads/lead-search";
import { LeadsPagination } from "@/components/leads/leads-pagination";
import { SourceFilterChips } from "@/components/leads/source-filter-chips";
import { PageHeader } from "@/components/dashboard/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadSourceBadgeClasses, pipelineStageBadgeClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

const PAGE_SIZE = 15;

function isValidStage(value: string | undefined): value is PipelineStage {
  return !!value && (pipelineStageEnum.enumValues as readonly string[]).includes(value);
}

function isValidSource(value: string | undefined): value is LeadSource {
  return !!value && (leadSourceEnum.enumValues as readonly string[]).includes(value);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; source?: string; q?: string; page?: string }>;
}) {
  const scope = await requireTrainer();
  const params = await searchParams;
  const stage = isValidStage(params.stage) ? params.stage : undefined;
  const source = isValidSource(params.source) ? params.source : undefined;
  const search = params.q;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { leads, total } = await listLeadsPaged(scope, { stage, source, search, page, pageSize: PAGE_SIZE });

  function buildHref(nextPage: number) {
    const qp = new URLSearchParams();
    if (stage) qp.set("stage", stage);
    if (source) qp.set("source", source);
    if (search) qp.set("q", search);
    if (nextPage > 1) qp.set("page", String(nextPage));
    const query = qp.toString();
    return query ? `/leads?${query}` : "/leads";
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.leads.title}>
        <CreateLeadDialog />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <LeadSearch current={search} />
        <SourceFilterChips current={source} />
        <LeadFilters currentStage={stage} />
      </div>

      {leads.length === 0 ? (
        <p className="text-muted-foreground">{search || stage || source ? sl.leads.noResults : sl.leads.empty}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sl.leads.columnName}</TableHead>
                <TableHead>{sl.leads.columnEmail}</TableHead>
                <TableHead>{sl.leads.columnSource}</TableHead>
                <TableHead>{sl.leads.columnStage}</TableHead>
                <TableHead>{sl.leads.columnCreated}</TableHead>
                <TableHead className="text-right">{sl.leads.columnActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className={avatarTintClass(lead.id)}>
                          {initials(lead.name, lead.email)}
                        </AvatarFallback>
                      </Avatar>
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.name ?? lead.email}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={leadSourceBadgeClasses[lead.source]}>
                      {leadSourceLabels[lead.source]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={pipelineStageBadgeClasses[lead.stage]}>
                      {pipelineStageLabels[lead.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.createdAt.toLocaleDateString("sl-SI")}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <EditLeadDialog
                        leadId={lead.id}
                        defaultValues={{ name: lead.name ?? undefined, email: lead.email, phone: lead.phone ?? undefined }}
                      />
                      <DeleteLeadButton leadId={lead.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-3 pb-3">
            <LeadsPagination page={page} pageSize={PAGE_SIZE} total={total} buildHref={buildHref} />
          </div>
        </div>
      )}
    </div>
  );
}

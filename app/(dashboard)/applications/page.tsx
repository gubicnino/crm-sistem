import Link from "next/link";
import { ApplicationList } from "@/components/applications/application-list";
import { MarkContactedButton } from "@/components/applications/mark-contacted-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { AnswersView } from "@/components/leads/answers-view";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLeads } from "@/db/queries/leads";
import { getTrainer } from "@/db/queries/trainers";
import { pipelineStageBadgeClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials } from "@/lib/display";
import { isTerminalStage } from "@/lib/pipeline";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const scope = await requireTrainer();
  const params = await searchParams;
  const [applications, trainer] = await Promise.all([
    listLeads(scope, { source: "application" }),
    getTrainer(scope),
  ]);

  const selected = params.lead
    ? (applications.find((lead) => lead.id === params.lead) ?? applications[0] ?? null)
    : (applications[0] ?? null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.applications.title} />

      {applications.length === 0 ? (
        <p className="text-muted-foreground">{sl.applications.empty}</p>
      ) : (
        <div className="grid grid-cols-[340px_1fr] gap-4">
          <ApplicationList applications={applications} selectedLeadId={selected?.id ?? null} />

          {selected ? (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-5 flex items-start justify-between gap-4 border-b pb-5">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className={avatarTintClass(selected.id)}>
                      {initials(selected.name, selected.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-semibold">{selected.name ?? selected.email}</p>
                    <p className="flex gap-3 text-sm text-muted-foreground">
                      <span>{selected.email}</span>
                      {selected.phone && <span>{selected.phone}</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className={pipelineStageBadgeClasses[selected.stage]}>
                    {pipelineStageLabels[selected.stage]}
                  </Badge>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {sl.applications.submittedOn(selected.createdAt.toLocaleString("sl-SI"))}
                  </p>
                </div>
              </div>

              <AnswersView answers={selected.answers} questions={trainer?.applicationQuestions ?? []} layout="cards" />

              <div className="mt-6 flex gap-2 border-t pt-5">
                {(selected.stage === "email_lead" || selected.stage === "application_received") &&
                  !isTerminalStage(selected.stage) && <MarkContactedButton leadId={selected.id} />}
                <Button variant="outline" render={<Link href={`/leads/${selected.id}`} />}>
                  {sl.applications.openInLeads}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border bg-card p-6 text-muted-foreground">
              {sl.applications.selectPrompt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

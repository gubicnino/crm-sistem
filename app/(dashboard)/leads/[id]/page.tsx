import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswersView } from "@/components/leads/answers-view";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog";
import { NotesPanel } from "@/components/leads/notes-panel";
import { StageActions } from "@/components/leads/stage-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLead } from "@/db/queries/leads";
import { listNotes } from "@/db/queries/notes";
import { getTrainer } from "@/db/queries/trainers";
import { leadSourceLabels, pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTrainer();
  const lead = await getLead(scope, id);
  if (!lead) notFound();

  const [notes, trainer] = await Promise.all([listNotes(scope, id), getTrainer(scope)]);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/leads" className="text-sm text-muted-foreground hover:underline">
        &larr; {sl.leads.backToList}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{lead.name ?? lead.email}</h1>
          <p className="text-sm text-muted-foreground">
            {leadSourceLabels[lead.source]} · {pipelineStageLabels[lead.stage]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageActions leadId={lead.id} currentStage={lead.stage} />
          <EditLeadDialog
            leadId={lead.id}
            defaultValues={{ name: lead.name ?? undefined, email: lead.email, phone: lead.phone ?? undefined }}
          />
          <DeleteLeadButton leadId={lead.id} />
        </div>
      </div>

      {lead.unsubscribedAt && <p className="text-sm text-destructive">{sl.leads.unsubscribedNotice}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{sl.leads.contactInfo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p>
            {sl.leads.columnEmail}: {lead.email}
          </p>
          {lead.phone && (
            <p>
              {sl.leads.phoneLabel}: {lead.phone}
            </p>
          )}
        </CardContent>
      </Card>

      <AnswersView answers={lead.answers} questions={trainer?.applicationQuestions ?? []} />

      <NotesPanel leadId={lead.id} notes={notes} />
    </div>
  );
}

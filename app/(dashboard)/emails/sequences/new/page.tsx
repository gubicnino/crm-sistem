import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { SequenceForm } from "@/components/emails/sequence-form";
import { listEmailSequencesForTrainer } from "@/db/queries/email-sequences";
import { getTrainer } from "@/db/queries/trainers";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { pipelineStageLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function NewEmailSequencePage() {
  const scope = await requireTrainer();
  const sequences = await listEmailSequencesForTrainer(scope);
  if (sequences.length >= MAX_SEQUENCES_PER_TRAINER) {
    redirect("/emails/sequences");
  }
  const trainer = await getTrainer(scope);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.emails.sequenceNewTitle}>
        <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
          {sl.emails.sequenceBackToList}
        </Button>
      </PageHeader>
      <SequenceForm trainerName={trainer?.name ?? ""} stageLabels={trainer?.stageLabels ?? pipelineStageLabels} />
    </div>
  );
}

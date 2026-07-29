import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyToExistingButton } from "@/components/emails/apply-to-existing-button";
import { Button } from "@/components/ui/button";
import { SequenceForm } from "@/components/emails/sequence-form";
import { getEmailSequenceWithSteps, listLeadsEnrolledInSequence } from "@/db/queries/email-sequences";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EditEmailSequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTrainer();
  const result = await getEmailSequenceWithSteps(scope, id);
  if (!result) notFound();

  const enrolledLeads = await listLeadsEnrolledInSequence(scope, id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sequenceEditTitle}</h1>
        <div className="flex gap-2">
          <ApplyToExistingButton sequenceId={id} enrolledCount={enrolledLeads.length} />
          <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
            {sl.emails.sequenceBackToList}
          </Button>
        </div>
      </div>
      <SequenceForm sequence={result.sequence} steps={result.steps} />
    </div>
  );
}

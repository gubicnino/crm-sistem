import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SequenceForm } from "@/components/emails/sequence-form";
import { getEmailSequenceWithSteps } from "@/db/queries/email-sequences";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EditEmailSequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTrainer();
  const result = await getEmailSequenceWithSteps(scope, id);
  if (!result) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sequenceEditTitle}</h1>
        <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
          {sl.emails.sequenceBackToList}
        </Button>
      </div>
      <SequenceForm sequence={result.sequence} steps={result.steps} />
    </div>
  );
}

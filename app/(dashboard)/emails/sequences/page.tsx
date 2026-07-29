import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SequenceList } from "@/components/emails/sequence-list";
import { listEmailSequencesForTrainer } from "@/db/queries/email-sequences";
import { MAX_SEQUENCES_PER_TRAINER } from "@/lib/email/constants";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EmailSequencesPage() {
  const scope = await requireTrainer();
  const sequences = await listEmailSequencesForTrainer(scope);
  const atLimit = sequences.length >= MAX_SEQUENCES_PER_TRAINER;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/emails" className="text-sm text-muted-foreground hover:underline">
        &larr; {sl.emails.title}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.sequencesTitle}</h1>
        <Button size="sm" disabled={atLimit} render={<Link href="/emails/sequences/new" />}>
          {sl.emails.sequenceCreate}
        </Button>
      </div>
      {atLimit && <p className="text-sm text-muted-foreground">{sl.emails.sequenceLimitReached}</p>}
      <SequenceList sequences={sequences} />
    </div>
  );
}

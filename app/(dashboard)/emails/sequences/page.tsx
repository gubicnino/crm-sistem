import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SegmentedNav } from "@/components/dashboard/segmented-nav";
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
      <PageHeader title={sl.emails.title} description={sl.emails.subtitle}>
        <Button size="sm" disabled={atLimit} render={<Link href="/emails/sequences/new" />}>
          {sl.emails.sequenceCreate}
        </Button>
      </PageHeader>

      <SegmentedNav
        items={[
          { href: "/emails", label: sl.emails.navAllEmails },
          { href: "/emails/sequences", label: sl.emails.navSequences },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        {sequences.length} / {MAX_SEQUENCES_PER_TRAINER} {sl.emails.sequencesTitle.toLowerCase()}
        {atLimit && ` — ${sl.emails.sequenceLimitReached}`}
      </p>
      <SequenceList sequences={sequences} />
    </div>
  );
}

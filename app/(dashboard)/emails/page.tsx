import Link from "next/link";
import { CancelSequenceButton } from "@/components/emails/cancel-sequence-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listScheduledEmailsForTrainer } from "@/db/queries/scheduled-emails";
import { scheduledEmailStatusLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

export default async function EmailsPage() {
  const scope = await requireTrainer();
  const emails = await listScheduledEmailsForTrainer(scope);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{sl.emails.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href="/emails/send" />}>
            {sl.emails.sendManual}
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/emails/sequences" />}>
            {sl.emails.manageSequences}
          </Button>
        </div>
      </div>
      {emails.length === 0 ? (
        <p className="text-muted-foreground">{sl.emails.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{sl.emails.columnLead}</TableHead>
              <TableHead>{sl.emails.columnStep}</TableHead>
              <TableHead>{sl.emails.columnStatus}</TableHead>
              <TableHead>{sl.emails.columnScheduledFor}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((email) => (
              <TableRow key={email.id}>
                <TableCell>{email.leadName ?? email.leadEmail}</TableCell>
                <TableCell>{email.sequenceStep}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{scheduledEmailStatusLabels[email.status]}</Badge>
                </TableCell>
                <TableCell>{email.scheduledFor.toLocaleString("sl-SI")}</TableCell>
                <TableCell>
                  {(email.status === "scheduled" || email.status === "pending") && (
                    <CancelSequenceButton leadId={email.leadId} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

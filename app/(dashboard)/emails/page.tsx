import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SegmentedNav } from "@/components/dashboard/segmented-nav";
import { CancelSequenceButton } from "@/components/emails/cancel-sequence-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getScheduledEmailStats, listScheduledEmailsForTrainer, type ScheduledEmailWithLead } from "@/db/queries/scheduled-emails";
import { scheduledEmailStatusBadgeClasses } from "@/lib/badge-styles";
import { scheduledEmailStatusLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { requireTrainer } from "@/lib/tenant";

function sequenceLabel(email: ScheduledEmailWithLead): string {
  if (email.kind === "broadcast") return sl.emails.sequenceFallbackBroadcast;
  return email.sequenceName ?? sl.emails.sequenceFallbackDeleted;
}

function stepLabel(email: ScheduledEmailWithLead): string {
  return email.stepPosition !== null ? sl.emails.stepTitle(email.stepPosition + 1) : "—";
}

function canceledReason(email: ScheduledEmailWithLead): string {
  if (email.leadUnsubscribedAt) return sl.emails.canceledReasonUnsubscribed;
  if (email.leadStage === "client") return sl.emails.canceledReasonClient;
  if (email.leadStage === "lost") return sl.emails.canceledReasonLost;
  return sl.emails.canceledReasonManual;
}

export default async function EmailsPage() {
  const scope = await requireTrainer();
  const [emails, stats] = await Promise.all([listScheduledEmailsForTrainer(scope), getScheduledEmailStats(scope)]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={sl.emails.title} description={sl.emails.subtitle}>
        <Button variant="outline" size="sm" render={<Link href="/emails/send" />}>
          {sl.emails.sendManual}
        </Button>
      </PageHeader>

      <SegmentedNav
        items={[
          { href: "/emails", label: sl.emails.navAllEmails },
          { href: "/emails/sequences", label: sl.emails.navSequences },
        ]}
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{sl.emails.kpiScheduled}</p>
          <p className="mt-2 text-2xl font-semibold">{stats.scheduled}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{sl.emails.kpiSentThisWeek}</p>
          <p className="mt-2 text-2xl font-semibold">{stats.sentThisWeek}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{sl.emails.kpiCanceledThisWeek}</p>
          <p className="mt-2 text-2xl font-semibold">{stats.canceledThisWeek}</p>
        </div>
      </div>

      {emails.length === 0 ? (
        <p className="text-muted-foreground">{sl.emails.empty}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sl.emails.columnLead}</TableHead>
                <TableHead>{sl.emails.columnSequence}</TableHead>
                <TableHead>{sl.emails.columnStep}</TableHead>
                <TableHead>{sl.emails.columnScheduledFor}</TableHead>
                <TableHead>{sl.emails.columnStatus}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-medium">{email.leadName ?? email.leadEmail}</TableCell>
                  <TableCell className="text-muted-foreground">{sequenceLabel(email)}</TableCell>
                  <TableCell className="text-muted-foreground">{stepLabel(email)}</TableCell>
                  <TableCell className="text-muted-foreground">{email.scheduledFor.toLocaleString("sl-SI")}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={scheduledEmailStatusBadgeClasses[email.status]}
                    >
                      {scheduledEmailStatusLabels[email.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {email.status === "scheduled" || email.status === "pending" ? (
                      <CancelSequenceButton leadId={email.leadId} />
                    ) : email.status === "canceled" ? (
                      <span className="text-xs text-muted-foreground">{canceledReason(email)}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

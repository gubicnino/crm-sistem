"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/emails/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Lead, PipelineStage } from "@/db/schema";
import type { EmailDocNode } from "@/db/types";
import { sendBroadcastAction } from "@/lib/actions/broadcast";
import { leadSourceLabels } from "@/lib/labels";
import { sl } from "@/lib/strings";
import { broadcastFormSchema } from "@/lib/validation/broadcast";

const EMPTY_BODY: EmailDocNode = { type: "doc", content: [{ type: "paragraph", content: [] }] };

/** Only the leads the parent page already filtered to unsubscribed=false,
 *  terminal-stage=false (see app/(dashboard)/emails/send/page.tsx) — this
 *  component never re-derives that filter, it only lets the trainer pick
 *  among what's already eligible. */
export function BroadcastForm({ leads, stageLabels }: { leads: Lead[]; stageLabels: Record<PipelineStage, string> }) {
  const router = useRouter();
  // Minted once per compose session (not per submit attempt) — a
  // double-click or a retried request carries the SAME id, so the server
  // resolves it to one broadcast instead of sending twice. See
  // lib/validation/broadcast.ts's clientRequestId doc.
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState<EmailDocNode>(EMPTY_BODY);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const allSelected = leads.length > 0 && leads.every((lead) => selected.has(lead.id));

  function toggleLead(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((lead) => lead.id)));
  }

  function buildPayload() {
    return {
      clientRequestId,
      subject,
      body,
      leadIds: [...selected],
      scheduledFor: scheduleMode === "now" || !scheduledAt ? null : new Date(scheduledAt),
    };
  }

  function handleOpenConfirm() {
    const parsed = broadcastFormSchema.safeParse(buildPayload());
    if (!parsed.success) {
      toast.error(sl.errors.validation);
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirmSend() {
    const parsed = broadcastFormSchema.safeParse(buildPayload());
    if (!parsed.success) {
      setConfirmOpen(false);
      toast.error(sl.errors.validation);
      return;
    }
    startTransition(async () => {
      const result = await sendBroadcastAction(parsed.data);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(sl.errors.validation);
        return;
      }
      toast.success(sl.emails.sendSuccess(result.recipientCount, result.skippedCount));
      router.push("/emails");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{sl.emails.sendRecipientsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={toggleAll} disabled={leads.length === 0}>
              {allSelected ? sl.emails.sendDeselectAll : sl.emails.sendSelectAll}
            </Button>
            <span className="text-sm text-muted-foreground">{sl.emails.sendSelectedCount(selected.size)}</span>
          </div>
          {leads.length === 0 ? (
            <p className="text-muted-foreground">{sl.emails.sendRecipientsEmpty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>{sl.leads.columnName}</TableHead>
                  <TableHead>{sl.leads.columnEmail}</TableHead>
                  <TableHead>{sl.leads.columnStage}</TableHead>
                  <TableHead>{sl.leads.columnSource}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={lead.name ?? lead.email}
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => toggleLead(lead.id)}
                      />
                    </TableCell>
                    <TableCell>{lead.name ?? lead.email}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{stageLabels[lead.stage]}</Badge>
                    </TableCell>
                    <TableCell>{leadSourceLabels[lead.source]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{sl.emails.sendTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sendSubjectLabel}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sendBodyLabel}</Label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{sl.emails.sendScheduleLabel}</Label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="scheduleMode"
                  checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")}
                />
                {sl.emails.sendScheduleNow}
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="scheduleMode"
                  checked={scheduleMode === "later"}
                  onChange={() => setScheduleMode("later")}
                />
                {sl.emails.sendScheduleLater}
              </label>
              {scheduleMode === "later" && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-auto"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="button" onClick={handleOpenConfirm} loading={isPending} className="self-end">
        {sl.emails.sendConfirmButton}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sl.emails.sendConfirmTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{sl.emails.sendConfirmBody(selected.size)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              {sl.leads.cancelButton}
            </Button>
            <Button onClick={handleConfirmSend} loading={isPending}>
              {sl.emails.sendConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

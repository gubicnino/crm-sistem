import { getLeadByIdUnscoped, markLeadUnsubscribed } from "@/db/queries/leads";
import { cancelSequenceForLead } from "@/lib/email/cancel";
import { sl } from "@/lib/strings";
import { systemScope } from "@/lib/tenant";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

async function unsubscribe(token: string): Promise<string> {
  const leadId = verifyUnsubscribeToken(token);
  if (!leadId) return sl.unsubscribe.invalid;

  const lead = await getLeadByIdUnscoped(leadId);
  if (!lead) return sl.unsubscribe.invalid;

  const scope = systemScope(lead.trainerId, "unsubscribe_token");

  // Idempotent: safe if the link is opened more than once.
  if (!lead.unsubscribedAt) {
    await markLeadUnsubscribed(scope, lead.id);
    await cancelSequenceForLead(scope, lead.id);
  }

  return sl.unsubscribe.success;
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const message = await unsubscribe(token);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}

"use server";

import { refresh } from "next/cache";
import { sendBroadcast } from "@/lib/email/broadcast";
import { requireTrainerOrThrow } from "@/lib/tenant";
import { broadcastFormSchema } from "@/lib/validation/broadcast";

export type SendBroadcastActionResult =
  | { ok: true; recipientCount: number; skippedCount: number }
  | { ok: false; error: string };

/** The trainer's one-off manual send — see lib/email/broadcast.ts's
 *  sendBroadcast for what it does. `leadIds` is re-validated here even
 *  though the UI only lets the trainer check eligible leads, since a
 *  client-supplied list can never be trusted as-is (see broadcastFormSchema
 *  and sendBroadcast's own hard server-side exclusion). */
export async function sendBroadcastAction(input: unknown): Promise<SendBroadcastActionResult> {
  const parsed = broadcastFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const scope = await requireTrainerOrThrow();
  const result = await sendBroadcast(scope, parsed.data);
  refresh();
  return { ok: true, recipientCount: result.recipientCount, skippedCount: result.skippedCount };
}

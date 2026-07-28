"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { setTrainerDeactivated } from "@/db/queries/admin";
import { setTrainerFromEmail } from "@/db/queries/trainers";
import { cancelAllSequencesForTrainer } from "@/lib/email/cancel";
import { resend, FROM_EMAIL } from "@/lib/email/client";
import { InviteEmail } from "@/lib/email/templates/invite";
import { mintInvite, inviteLink } from "@/lib/invites";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdminOrThrow, systemScope } from "@/lib/tenant";
import { fromEmailSchema, inviteTrainerSchema, trainerIdSchema } from "@/lib/validation/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type InviteActionResult =
  | { ok: true; inviteLink: string; emailSent: boolean }
  | { ok: false; error: string };

/**
 * Enters impersonation. Gated on requireAdminOrThrow() here for a real error
 * message — but that check is NOT the security boundary. The security
 * boundary is lib/impersonation.ts's applyImpersonationUpdate, which
 * re-verifies token.role from the signed JWT before writing anything, because
 * /api/auth/session is reachable without ever going through this action.
 */
export async function enterImpersonationAction(trainerId: string): Promise<void> {
  await requireAdminOrThrow();
  const parsed = trainerIdSchema.safeParse(trainerId);
  if (!parsed.success) {
    throw new Error("Invalid trainer id");
  }
  const { unstable_update } = await import("@/lib/auth");
  await unstable_update({ user: { impersonatingTrainerId: parsed.data } });
  redirect("/leads");
}

/**
 * Exits impersonation. Deliberately NOT gated on requireAdminOrThrow() —
 * getting out must always work, even from a half-broken state. Harmless for a
 * non-admin: the payload is a no-op once applyImpersonationUpdate() sees
 * token.role !== "admin".
 */
export async function exitImpersonationAction(): Promise<void> {
  const { unstable_update } = await import("@/lib/auth");
  await unstable_update({ user: { impersonatingTrainerId: null } });
  redirect("/admin");
}

export async function setTrainerFromEmailAction(trainerId: string, value: string | null): Promise<ActionResult> {
  await requireAdminOrThrow();

  const idParsed = trainerIdSchema.safeParse(trainerId);
  if (!idParsed.success) {
    return { ok: false, error: "validation" };
  }

  if (value === null) {
    await setTrainerFromEmail(systemScope(idParsed.data, "admin_console"), null);
    refresh();
    return { ok: true };
  }

  const valueParsed = fromEmailSchema.safeParse(value);
  if (!valueParsed.success) {
    return { ok: false, error: valueParsed.error.issues[0]?.message ?? "validation" };
  }

  await setTrainerFromEmail(systemScope(idParsed.data, "admin_console"), valueParsed.data);
  refresh();
  return { ok: true };
}

export async function inviteTrainerAction(
  _prevState: InviteActionResult | undefined,
  formData: FormData,
): Promise<InviteActionResult> {
  const admin = await requireAdminOrThrow();

  const withinLimit = await checkRateLimit(`admin_invite:${admin.userId}`, { limit: 20, windowSeconds: 3600 });
  if (!withinLimit) {
    return { ok: false, error: "rateLimited" };
  }

  const parsed = inviteTrainerSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const { rawToken } = await mintInvite(parsed.data.email);
  const link = inviteLink(rawToken);

  // Resend's SDK reports API errors via the returned { error } field, not by
  // throwing — see scripts/create-invite.ts for the identical pattern. The
  // invite (and its link) already exists regardless of send success, so we
  // always return it — the operator can hand it over manually.
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: parsed.data.email,
    subject: "Povabilo v Trener Growth Sistem",
    react: InviteEmail({ inviteLink: link }),
  });
  if (error) {
    console.warn("[admin] failed to send invite email (link still valid):", error);
  }

  refresh();
  return { ok: true, inviteLink: link, emailSent: !error };
}

export async function deactivateTrainerAction(trainerId: string): Promise<ActionResult> {
  await requireAdminOrThrow();
  const parsed = trainerIdSchema.safeParse(trainerId);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  // Cancel first, flag second — per CLAUDE.md, a deactivated trainer must
  // never keep a lead's sequence emails scheduled with no way to cancel them.
  const scope = systemScope(parsed.data, "admin_console");
  const cancelResult = await cancelAllSequencesForTrainer(scope);
  if (cancelResult.failed > 0) {
    // Never block deactivation on this — see lib/email/cancel.ts's
    // cancel_failed handling, which the cron reconciler retries. Logged so an
    // operator scanning server logs can follow up manually in the meantime.
    console.warn(
      `[admin] deactivateTrainerAction: ${cancelResult.failed} scheduled email(s) failed to cancel for trainer ${parsed.data}`,
    );
  }
  const updated = await setTrainerDeactivated(parsed.data, new Date());
  if (!updated) {
    return { ok: false, error: "notFound" };
  }

  refresh();
  return { ok: true };
}

export async function reactivateTrainerAction(trainerId: string): Promise<ActionResult> {
  await requireAdminOrThrow();
  const parsed = trainerIdSchema.safeParse(trainerId);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const updated = await setTrainerDeactivated(parsed.data, null);
  if (!updated) {
    return { ok: false, error: "notFound" };
  }

  refresh();
  return { ok: true };
}

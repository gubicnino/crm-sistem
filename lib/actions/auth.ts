"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { createUserAndTrainer, getUserByEmail, updateUserPasswordHash } from "@/db/queries/auth";
import { resend, FROM_EMAIL } from "@/lib/email/client";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";
import { verifyInviteToken } from "@/lib/invites";
import { signIn, signOut } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { mintPasswordResetToken, passwordResetLink, redeemPasswordResetToken } from "@/lib/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateSiteKey } from "@/lib/site-key";
import {
  loginSchema,
  redeemInviteSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function loginAction(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "loginFailed" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/after-login",
    });
  } catch (err) {
    // signIn() throws AuthError (specifically CredentialsSignin) when
    // authorize() returns null; it throws a NEXT_REDIRECT error on success,
    // which must propagate rather than be reported as a failure.
    if (err instanceof AuthError) {
      return { ok: false, error: "loginFailed" };
    }
    throw err;
  }
  return { ok: true };
}

export async function redeemInviteAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ip = await clientIp();
  const withinLimit = await checkRateLimit(`invite_redeem:ip:${ip}`, { limit: 10, windowSeconds: 600 });
  if (!withinLimit) {
    return { ok: false, error: "rateLimited" };
  }

  const parsed = redeemInviteSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const invite = await verifyInviteToken(parsed.data.token);
  if (!invite) {
    return { ok: false, error: "inviteInvalid" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const siteKey = generateSiteKey(parsed.data.name);

  await createUserAndTrainer({
    email: invite.email,
    passwordHash,
    name: parsed.data.name,
    siteKey,
    inviteId: invite.id,
  });

  try {
    await signIn("credentials", {
      email: invite.email,
      password: parsed.data.password,
      redirectTo: "/after-login",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Shouldn't happen — we just created these credentials — but don't
      // strand the user on an error page if it somehow does.
      redirect("/login");
    }
    throw err;
  }
  return { ok: true };
}

export async function requestPasswordResetAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ip = await clientIp();
  const withinLimit = await checkRateLimit(`pwreset:ip:${ip}`, { limit: 5, windowSeconds: 600 });

  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  // Always the same response whether or not the email exists, and whether or
  // not the rate limit was hit — an attacker must not learn which. A hit
  // silently skips the send rather than returning a different result.
  if (withinLimit) {
    const user = await getUserByEmail(parsed.data.email);
    if (user) {
      const rawToken = await mintPasswordResetToken(user.id);
      // Resend's SDK reports API errors via the returned { error } field, not
      // by throwing. Log and continue either way — the caller must not learn
      // whether the send succeeded (see the comment above).
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: "Ponastavitev gesla — Trener Growth Sistem",
        react: PasswordResetEmail({ resetLink: passwordResetLink(rawToken) }),
      });
      if (error) {
        console.error("[password-reset] failed to send email:", error);
      }
    }
  }

  return { ok: true };
}

export async function resetPasswordAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }

  const userId = await redeemPasswordResetToken(parsed.data.token);
  if (!userId) {
    return { ok: false, error: "resetPasswordInvalid" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await updateUserPasswordHash(userId, passwordHash);

  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/lib/actions/auth";
import { sl } from "@/lib/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {sl.auth.resetPasswordSubmit}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, undefined);

  if (state?.ok === true) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{sl.auth.resetPasswordSuccess}</p>
        <Link href="/login" className={buttonVariants({ className: "w-full" })}>
          {sl.auth.loginTitle}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{sl.auth.passwordLabel}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state?.ok === false && (
        <p className="text-sm text-destructive">
          {state.error === "resetPasswordInvalid" ? sl.auth.resetPasswordInvalid : sl.errors.validation}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}

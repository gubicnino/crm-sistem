"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { sl } from "@/lib/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {sl.auth.forgotPasswordSubmit}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, undefined);

  if (state?.ok === true) {
    return <p className="text-sm text-muted-foreground">{sl.auth.forgotPasswordSent}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{sl.auth.emailLabel}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{sl.errors.validation}</p>}
      <SubmitButton />
    </form>
  );
}

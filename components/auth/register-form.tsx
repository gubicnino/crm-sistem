"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemInviteAction } from "@/lib/actions/auth";
import { sl } from "@/lib/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full">
      {sl.auth.registerButton}
    </Button>
  );
}

export function RegisterForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useActionState(redeemInviteAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{sl.auth.emailLabel}</Label>
        <Input id="email" value={email} disabled readOnly />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{sl.auth.nameLabel}</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
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
          {state.error === "inviteInvalid"
            ? sl.auth.inviteInvalid
            : state.error === "rateLimited"
              ? sl.errors.rateLimited
              : sl.errors.validation}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}

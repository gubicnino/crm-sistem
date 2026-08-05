"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/actions/auth";
import { sl } from "@/lib/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-full">
      {sl.auth.loginButton}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{sl.auth.emailLabel}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{sl.auth.passwordLabel}</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state?.ok === false && <p className="text-sm text-destructive">{sl.auth.loginFailed}</p>}
      <SubmitButton />
      <Link href="/forgot-password" className="text-center text-sm text-muted-foreground hover:underline">
        {sl.auth.forgotPasswordLink}
      </Link>
    </form>
  );
}

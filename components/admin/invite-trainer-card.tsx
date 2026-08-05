"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { inviteTrainerAction } from "@/lib/actions/admin";
import { sl } from "@/lib/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {sl.admin.inviteSubmit}
    </Button>
  );
}

export function InviteTrainerCard() {
  const [state, formAction] = useActionState(inviteTrainerAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sl.admin.inviteTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="invite-email">{sl.admin.inviteEmailLabel}</Label>
            <Input id="invite-email" name="email" type="email" required autoComplete="email" />
          </div>
          <SubmitButton />
        </form>
        {state?.ok === false && (
          <p className="text-sm text-destructive">
            {state.error === "rateLimited" ? sl.errors.rateLimited : sl.errors.validation}
          </p>
        )}
        {state?.ok === true && (
          <div className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
            <p>{sl.admin.inviteCreated}</p>
            {!state.emailSent && <p className="text-destructive">{sl.admin.inviteSendFailed}</p>}
            <p className="text-muted-foreground">{sl.admin.inviteLinkLabel}:</p>
            <code className="break-all">{state.inviteLink}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

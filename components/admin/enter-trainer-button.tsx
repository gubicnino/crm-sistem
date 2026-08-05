"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { enterImpersonationAction } from "@/lib/actions/admin";
import { sl } from "@/lib/strings";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" loading={pending}>
      {sl.admin.enterTrainer}
    </Button>
  );
}

/** The form itself stays a plain Server Action binding — unstable_update()
 *  (called inside the action) writes cookies, which only works from a real
 *  Server Action invocation, see lib/actions/admin.ts's enterImpersonationAction
 *  doc comment. Only the submit button is client, to show pending state
 *  while the impersonation redirect is in flight. */
export function EnterTrainerButton({ trainerId }: { trainerId: string }) {
  return (
    <form action={enterImpersonationAction.bind(null, trainerId)}>
      <SubmitButton />
    </form>
  );
}

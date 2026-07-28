import { Button } from "@/components/ui/button";
import { enterImpersonationAction } from "@/lib/actions/admin";
import { sl } from "@/lib/strings";

/** Server Component: a plain form bound to the trainer id, no client JS
 *  needed. unstable_update() (called inside the action) writes cookies,
 *  which only works from a real Server Action invocation — see
 *  lib/actions/admin.ts's enterImpersonationAction doc comment. */
export function EnterTrainerButton({ trainerId }: { trainerId: string }) {
  return (
    <form action={enterImpersonationAction.bind(null, trainerId)}>
      <Button type="submit" size="sm" variant="outline">
        {sl.admin.enterTrainer}
      </Button>
    </form>
  );
}

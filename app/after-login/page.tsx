import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Post-login dispatcher. Exists because the destination depends on a fact
 * only the server knows (users.role), and proxy.ts is forbidden from
 * decoding the JWT (see its header comment) — so it can't route by role
 * itself.
 *
 * Without this page, an admin — who has no trainers row — would be sent to
 * /leads by loginAction's redirectTo, bounced by requireTrainer() to /login
 * (no trainerId), and bounced right back to /leads by proxy.ts's
 * cookie-presence check. Forever. Landing everyone here first breaks that
 * loop: this page is not itself an auth page or a public page, so proxy.ts's
 * existing rules already require a session to reach it, and it always
 * terminates in exactly one further redirect.
 */
export default async function AfterLoginPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role === "admin" && !session.user.impersonatingTrainerId) {
    redirect("/admin");
  }
  redirect("/leads");
}

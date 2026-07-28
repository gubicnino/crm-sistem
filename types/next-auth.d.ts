import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/db/types";

declare module "next-auth" {
  interface Session {
    user: {
      /** The EFFECTIVE tenant. While an admin is impersonating, this is the
       *  impersonated trainer's id — that's what makes lib/tenant.ts's 17
       *  requireTrainer()/requireTrainerOrThrow() call sites work unchanged. */
      trainerId: string;
      /** Server-derived at sign-in from users.role — see lib/auth.ts's jwt
       *  callback and db/queries/auth.ts's getLoginIdentity. Never settable
       *  by a client. */
      role: UserRole;
      /** Non-null iff an admin is currently impersonating; always equal to
       *  `trainerId` when set. Drives the dashboard banner and the exit
       *  action — see lib/impersonation.ts. */
      impersonatingTrainerId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    trainerId?: string;
    role?: UserRole;
    impersonatingTrainerId?: string;
  }
}

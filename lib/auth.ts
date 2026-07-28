import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authAdapter } from "@/db/queries/auth-adapter";
import { getLoginIdentity, getUserByEmail } from "@/db/queries/auth";
import { isImpersonableTrainer } from "@/db/queries/admin";
import { applyImpersonationUpdate } from "@/lib/impersonation";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  adapter: authAdapter,
  // Credentials only supports JWT sessions — the adapter's `sessions` table
  // (kept for adapter-contract completeness, see db/schema.ts) goes unused.
  // No auth.config.ts edge split: that pattern existed so Edge middleware could
  // import a bcrypt-free subset. Next 16's proxy is nodejs-only and never
  // calls auth() (see proxy.ts), so one config file is correct here.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await getUserByEmail(parsed.data.email);
        // Always run the bcrypt compare, even on a miss (verifyPassword falls
        // back to a dummy hash), so response timing doesn't reveal whether the
        // account exists.
        const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);
        if (!user || !valid) return null;

        // A trainer whose account was deactivated by the operator, or an
        // orphaned user row with no trainer at all, must not get a session —
        // returning null here yields the existing generic "wrong email or
        // password" and, critically, avoids handing out a cookie that would
        // then bounce forever between /login and the dashboard (see
        // lib/tenant.ts's requireTrainer()).
        const identity = await getLoginIdentity(user.id);
        if (!identity) return null;
        if (identity.role !== "admin" && (!identity.trainerId || identity.trainerDeactivatedAt)) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Sign-in. The ONLY place `role` is ever written, and it comes from the
      // users row — never from a client-supplied payload (see
      // lib/impersonation.ts). Re-resolved on every login, so a role or
      // trainer change is picked up, and any stale impersonation from a
      // previous session is cleared.
      if (user?.id) {
        const identity = await getLoginIdentity(user.id);
        token.role = identity?.role ?? "trainer";
        token.trainerId = identity?.trainerId ?? undefined;
        delete token.impersonatingTrainerId;
        return token;
      }

      if (trigger === "update") {
        // `session` here is attacker-controlled — see lib/impersonation.ts's
        // header comment for why validation happens there, not here.
        return applyImpersonationUpdate(token, session, isImpersonableTrainer);
      }

      return token;
    },
    async session({ session, token }) {
      // Rebuilt via spread rather than direct property assignment: Auth.js's
      // callback param type is an intersection across its database/jwt session
      // variants that TS can't cleanly narrow for a plain mutation here.
      // trainerId may genuinely be absent at runtime (e.g. mid-registration, or
      // an admin who hasn't entered a trainer) — lib/tenant.ts treats that as
      // unauthenticated/no-tenant, so the `string` type here is the
      // common-case contract, not a runtime guarantee.
      return {
        ...session,
        user: {
          ...session.user,
          trainerId: token.trainerId as string,
          role: token.role ?? "trainer",
          impersonatingTrainerId: token.impersonatingTrainerId ?? null,
        },
      };
    },
  },
});

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authAdapter } from "@/db/queries/auth-adapter";
import { getUserByEmail } from "@/db/queries/auth";
import { getTrainerByUserId } from "@/db/queries/trainers";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Only resolve the trainer on sign-in (when `user` is present) — not on
      // every request, since the id then lives in the signed token. Re-resolves
      // fresh on every login, so a trainer's data changes are picked up.
      if (user?.id) {
        const trainer = await getTrainerByUserId(user.id);
        token.trainerId = trainer?.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Rebuilt via spread rather than direct property assignment: Auth.js's
      // callback param type is an intersection across its database/jwt session
      // variants that TS can't cleanly narrow for a plain mutation here.
      // trainerId may genuinely be absent at runtime (e.g. mid-registration) —
      // lib/tenant.ts treats that as unauthenticated, so the `string` type here
      // is the common-case contract, not a runtime guarantee.
      return {
        ...session,
        user: {
          ...session.user,
          trainerId: token.trainerId as string,
        },
      };
    },
  },
});

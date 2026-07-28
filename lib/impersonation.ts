import { z } from "zod";
import type { JWT } from "next-auth/jwt";

/**
 * THE trust boundary for admin impersonation. This is the single highest-risk
 * file in that feature — read this whole comment before touching the function
 * below.
 *
 * @auth/core hands the jwt callback's `session` param straight through from the
 * body of a POST to /api/auth/session (see node_modules/@auth/core/index.d.ts's
 * jwt callback docs: "this is the data sent from the client via the
 * `useSession().update` method. ⚠ Note, you should validate this data before
 * using it."). The callback CANNOT distinguish a server-side
 * `unstable_update()` call (lib/actions/admin.ts) from a browser-side POST to
 * that same endpoint — both arrive as the same in-process Auth() request (see
 * node_modules/next-auth/lib/actions.js's `update()`, which calls Auth() with
 * `skipCSRFCheck`). That endpoint IS CSRF-protected but not otherwise
 * privileged: any logged-in trainer can mint a CSRF token from /api/auth/csrf
 * and POST an arbitrary `session` payload here.
 *
 * Therefore, before an impersonation target is written into the token:
 *   (a) authority is read from `token.role` — a value written ONLY in the
 *       sign-in branch of lib/auth.ts's jwt callback, from the users row via
 *       getLoginIdentity(), and carried in the SIGNED token. It is never read
 *       from `payload`.
 *   (b) the requested trainerId must resolve to a real, active trainers row
 *       (checked via the injected `isImpersonableTrainer`, so this stays a
 *       pure, DB-free function for testing — see __tests__/impersonation.test.ts).
 *
 * A naive `token.trainerId = payload.impersonatingTrainerId` — skipping (a) —
 * is a total tenant-isolation bypass: any trainer could impersonate any other
 * trainer. Do not "simplify" this function.
 *
 * On any failure this returns the token UNCHANGED, silently. Failing loudly
 * (throwing, or a distinguishable no-op) would let a probing trainer use this
 * as an oracle for which trainer ids exist or which token shapes are valid.
 */
const impersonationUpdateSchema = z.object({
  user: z.object({
    impersonatingTrainerId: z.uuid().nullable(),
  }),
});

export async function applyImpersonationUpdate(
  token: JWT,
  payload: unknown,
  isImpersonableTrainer: (trainerId: string) => Promise<boolean>,
): Promise<JWT> {
  const parsed = impersonationUpdateSchema.safeParse(payload);
  if (!parsed.success) return token;

  // (a) Authority from the SIGNED token, NEVER from the payload. Checked
  // before any DB work, so a non-admin can't use this as an id-existence
  // oracle (see the "never called" test case).
  if (token.role !== "admin") return token;

  const target = parsed.data.user.impersonatingTrainerId;

  if (target === null) {
    // Exit impersonation. Delete rather than assign undefined: jwt.encode()
    // JSON-serializes the token, and an explicit delete is unambiguous either way.
    const next = { ...token };
    delete next.trainerId;
    delete next.impersonatingTrainerId;
    return next;
  }

  // (b) The target must exist and be active.
  if (!(await isImpersonableTrainer(target))) return token;

  // Invariant, enforced here and nowhere else: while impersonating, the
  // effective tenant (trainerId, read by every requireTrainer()/
  // requireTrainerOrThrow() call site) and the provenance marker
  // (impersonatingTrainerId, read by the dashboard banner) are the same id.
  return { ...token, trainerId: target, impersonatingTrainerId: target };
}

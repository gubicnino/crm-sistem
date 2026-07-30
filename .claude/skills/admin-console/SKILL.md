---
name: admin-console
description: 'Operator/admin subsystem: admin role model, invite-only trainer registration, and the impersonation security boundary. Load before touching app/(admin)/**, lib/impersonation.ts, lib/actions/admin.ts, lib/auth.ts, or lib/invites.ts.'
user-invocable: false
---

# Admin console & impersonation

This subsystem is entirely separate from the trainer-facing product and has no coverage elsewhere — read this before changing any of the files above.

## Two actor types, one `users` table

`users.role` is `"trainer"` (default) or `"admin"`. An admin row has **no matching `trainers` row** — `requireAdmin()` / `requireAdminOrThrow()` (`lib/tenant.ts`) are a parallel guard pair to `requireTrainer()`, returning an `AdminActor`, never a `TrainerScope`. An admin reaches trainer-scoped dashboard pages (`requireTrainer()`) only via impersonation.

`proxy.ts` bounces any cookie-bearing request off an auth page (`/login` etc.) to `/after-login`, not directly to `/leads` — an admin hitting `requireTrainer()` with no `trainerId` would otherwise loop straight back to `/login`. `/after-login` resolves the real destination server-side, by role.

## Impersonation's actual security boundary

`enterImpersonationAction` (`lib/actions/admin.ts`) is gated on `requireAdminOrThrow()`, but **that check is not the security boundary** — it's just where a real error message comes from. The boundary is `applyImpersonationUpdate` (`lib/impersonation.ts`), because `unstable_update()`'s target, `/api/auth/session`, is reachable directly: any logged-in trainer can mint a CSRF token from `/api/auth/csrf` and POST an arbitrary `session` payload there. Auth.js's `jwt` callback cannot distinguish that from a legitimate server-side `unstable_update()` call — both arrive as the same in-process request.

So `applyImpersonationUpdate` re-derives authority from `token.role`, read from the **signed JWT**, never from the untrusted payload, before writing anything. A naive `token.trainerId = payload.impersonatingTrainerId` — skipping that check — is a total tenant-isolation bypass: any trainer could impersonate any other trainer. The target `trainerId` is also re-verified against a real, active trainer via an injected `isImpersonableTrainer` callback (kept DB-free for testability — see `__tests__/impersonation.test.ts`). On any failure it returns the token **unchanged, silently** — a distinguishable error would make this an oracle for which trainer ids exist.

Invariant enforced only here: while impersonating, `token.trainerId` (read by every `requireTrainer()`/`requireTrainerOrThrow()` call site — i.e. the effective tenant) and `token.impersonatingTrainerId` (read by the dashboard's impersonation banner) are always the same id.

`exitImpersonationAction` is deliberately **not** gated on `requireAdminOrThrow()` — getting out must always work, even from a half-broken session state. It's harmless for a non-admin since `applyImpersonationUpdate` no-ops once `token.role !== "admin"`.

**Do not simplify `applyImpersonationUpdate`.** The file's own header comment says so; treat that literally.

## Invite-only registration

No public signup. `mintInvite` (`lib/invites.ts`) generates a random token, stores only its sha256 hash (`invites.tokenHash`) with a 7-day TTL, and the raw token lives solely in the invite link. `verifyInviteToken` collapses every invalid reason (not found / expired / already used) into the same `null` — don't distinguish them in a UI, same principle as password-reset token consumption. Invites are minted from the admin console (`inviteTrainerAction`) or the CLI (`npm run invite:create`).

## Trainer deactivation ordering

`deactivateTrainerAction` (`lib/actions/admin.ts`): **cancel first, flag second.** It calls `cancelAllSequencesForTrainer` before `setTrainerDeactivated` — a hard delete or a bare deactivation flag without that ordering would strand up to 30 days of Resend-scheduled sends with no way to cancel them. A `cancelResult.failed > 0` is logged but never blocks deactivation (the cron reconciler retries `cancel_failed` rows separately).

Deactivation is soft (`trainers.deactivatedAt`), not a delete. It's also not re-checked per request — sessions are stateless JWTs, so a login blocks immediately but an already-issued session/cookie (or an admin already impersonating that trainer) keeps dashboard access until natural JWT expiry. This is a known, reviewed trade-off (single-operator system, low blast radius), not a bug to silently "fix" with a per-request DB lookup — ask first if it needs closing.

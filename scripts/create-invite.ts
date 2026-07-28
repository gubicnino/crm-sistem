import { config } from "dotenv";

// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run invite:create -- trainer@example.com");
    process.exit(1);
  }

  // Imported after env is loaded, since these modules read process.env at
  // module-init time (db/index.ts, lib/email/client.ts).
  const { mintInvite, inviteLink } = await import("../lib/invites");

  const { rawToken } = await mintInvite(email);
  const link = inviteLink(rawToken);

  console.log(`Invite created for ${email}:`);
  console.log(link);

  // Resend's SDK reports API errors via the returned { error } field, not by
  // throwing — see lib/actions/auth.ts for the same handling.
  const { resend, FROM_EMAIL } = await import("../lib/email/client");
  const { InviteEmail } = await import("../lib/email/templates/invite");
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Povabilo v Trener Growth Sistem",
    react: InviteEmail({ inviteLink: link }),
  });
  if (error) {
    console.warn("Could not send the invite email (link above still works):", error);
  } else {
    console.log("Invite email sent.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

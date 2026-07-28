import { config } from "dotenv";
// npm run admin:create -- ops@example.com "Nino"
// The password is prompted for interactively, never passed as an argument —
// argv is visible in shell history, in `ps`/Task Manager, and in any CI or
// terminal log.
// Standalone script — see drizzle.config.ts for why this must be explicit.
config({ path: ".env.local" });

const MIN_PASSWORD_LENGTH = 8;

/**
 * Reads a line from the TTY without echoing it — not even as `*`, which would
 * leak the password's length. Uses only node:tty raw mode (a public Node
 * API), per CLAUDE.md's "do not add dependencies": no readline monkey-patch,
 * no third-party prompt library.
 */
async function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // Refuse a piped/redirected password — it would defeat the whole point of
    // prompting, and could silently consume something that isn't a password.
    throw new Error("A TTY is required — run this interactively, not through a pipe.");
  }

  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let buf = "";
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(buf);
          return;
        }
        if (ch === "") {
          // Ctrl-C
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Aborted."));
          return;
        }
        if (ch === "" || ch === "\b") {
          // Backspace/delete
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const [emailArg, nameArg] = process.argv.slice(2);
  if (!emailArg) {
    console.error('Usage: npm run admin:create -- ops@example.com "Display Name"');
    process.exit(1);
  }

  const { normalizedEmail } = await import("../lib/validation/shared");
  const { getUserByEmail } = await import("../db/queries/auth");
  const { createAdminUser } = await import("../db/queries/admin");
  const { hashPassword } = await import("../lib/password");

  const emailCheck = normalizedEmail(254, "Invalid email address.").safeParse(emailArg);
  if (!emailCheck.success) {
    console.error(emailCheck.error.issues[0]?.message ?? "Invalid email address.");
    process.exit(1);
  }
  const email = emailCheck.data;

  if (await getUserByEmail(email)) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const password = await promptHidden("Password: ");
  const confirm = await promptHidden("Confirm password: ");
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await createAdminUser({ email, name: nameArg ?? null, passwordHash });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(`Admin created: ${email}.`);
  console.log(`Log in at ${appUrl}/login — you'll land on /admin.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

import bcrypt from "bcryptjs";

const COST_FACTOR = 12;

// Hash of a fixed dummy value, compared against on every miss so authorize()
// takes roughly the same time whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", COST_FACTOR);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST_FACTOR);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}

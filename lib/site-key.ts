import { randomBytes } from "node:crypto";

const DIACRITIC_MARKS = /[̀-ͯ]/g;

/**
 * e.g. "pk_janez_kranjc_8f3a2b1c". Public by design — see CLAUDE.md's security
 * requirements: a site_key identifies a trainer, it does not authorize
 * anything on its own.
 */
export function generateSiteKey(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITIC_MARKS, "") // č/š/ž -> c/s/z after NFD decomposition
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "trainer";
  const suffix = randomBytes(4).toString("hex");
  return `pk_${slug}_${suffix}`;
}

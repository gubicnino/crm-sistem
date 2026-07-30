import { formatDistanceToNow } from "date-fns";
import { sl as slLocale } from "date-fns/locale";

/**
 * Initials for an avatar fallback — leads never have a profile image. Falls
 * back to the email's first letter when there's no name (lead_magnet leads
 * are often email-only).
 */
export function initials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

/** Deterministic per-id tint index (0-4) so avatars aren't monochrome — same id always maps to the same tint. */
const AVATAR_TINTS = [
  "bg-stage-1/20 text-stage-4",
  "bg-hot-tint text-hot-foreground",
  "bg-success-tint text-success",
  "bg-primary-tint text-primary-hover",
  "bg-secondary text-foreground",
] as const;

export function avatarTintClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

/** Slovenian relative-time label, e.g. "pred 4 urami". */
export function relativeDate(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: slLocale });
}

const DIACRITIC_MAP: Record<string, string> = { č: "c", š: "s", ž: "z", ć: "c", đ: "dj" };

/**
 * Auto-generates a lib/validation/questions.ts-compliant id (`^[a-z0-9_]{1,64}$`)
 * from a trainer-entered question label, so the raw id field never has to be
 * shown (CLAUDE.md: "no jargon, no raw JSON/IDs" for this page). Called once,
 * at the moment a new question is first saved — never regenerated on a later
 * label edit, since that would orphan the id's leads.answers key. Dedupes
 * against existingIds with a numeric suffix; falls back to `vprasanje_N` if
 * the label transliterates to nothing usable (e.g. emoji-only labels).
 */
export function slugifyQuestionId(label: string, existingIds: ReadonlySet<string>): string {
  const transliterated = label
    .toLowerCase()
    .replace(/[čšžćđ]/g, (ch) => DIACRITIC_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  const base = transliterated || "vprasanje";
  if (!existingIds.has(base)) return base;

  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`.slice(0, 64);
    if (!existingIds.has(candidate)) return candidate;
  }
}

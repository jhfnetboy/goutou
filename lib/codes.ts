// Project key (slug) + display code helpers. Keep all formatting in one
// place so renaming a slug propagates everywhere automatically.

export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 10;
export const SLUG_PATTERN = /^[A-Z0-9]{2,10}$/;

/**
 * Derive a slug suggestion from a project name. Picks the first letter of
 * each word for multi-word names ("Law Firm Management System" → "LFMS");
 * falls back to the first up-to-4 alnum chars for single-word names.
 */
export function deriveSlug(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "";

  const words = cleaned
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  if (words.length >= 2) {
    const initials = words.map((w) => w[0]).join("");
    if (initials.length >= SLUG_MIN_LENGTH) {
      return initials.slice(0, SLUG_MAX_LENGTH);
    }
  }

  const candidate = words[0].slice(
    0,
    Math.min(SLUG_MAX_LENGTH, Math.max(SLUG_MIN_LENGTH, 4)),
  );
  // A single-character name can't form a >= 2-char slug. Return "" so the caller
  // forces manual entry instead of suggesting an invalid 1-char slug.
  return candidate.length >= SLUG_MIN_LENGTH ? candidate : "";
}

/** Normalize raw user input to slug shape (uppercase, alnum-only). */
export function normalizeSlugInput(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export function formatTaskCode(
  slug: string | null,
  codeNumber: number | null,
): string | null {
  if (!slug || codeNumber === null || codeNumber === undefined) return null;
  return `${slug}-${codeNumber}`;
}

export function formatRequestCode(
  slug: string | null,
  codeNumber: number | null,
): string | null {
  if (!slug || codeNumber === null || codeNumber === undefined) return null;
  return `${slug}-CR-${codeNumber}`;
}

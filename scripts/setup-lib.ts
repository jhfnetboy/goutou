/**
 * Pure, side-effect-free helpers for the setup wizard, split out so they can be
 * unit-tested without driving the interactive prompts.
 */

import { randomBytes } from "node:crypto";

export function isEmail(value: string): string | null {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
    ? null
    : "Enter a valid email address.";
}

export function isUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:"
      ? null
      : "URL must start with http:// or https://.";
  } catch {
    return "Enter a valid absolute URL (e.g. https://app.example.com).";
  }
}

export function generateSecret(): string {
  return randomBytes(32).toString("base64");
}

/** Serialise an env map to `KEY=value\n` lines, skipping empty/undefined. */
export function renderEnv(vars: Record<string, string | undefined>): string {
  const lines = Object.entries(vars)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

/**
 * Extract a D1 database id from `wrangler d1 create` output. The id is a
 * canonical UUID and may appear as `database_id = "<uuid>"` (TOML snippet),
 * `"database_id": "<uuid>"` (JSON), or unquoted, depending on wrangler version.
 * Anchored on the `database_id` key so it never grabs an unrelated UUID.
 */
export function extractD1Id(output: string): string | null {
  const match = output.match(
    /["']?database_id["']?\s*[:=]\s*["']?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})["']?/,
  );
  return match ? match[1] : null;
}

/**
 * Replace the wrangler.jsonc D1 id placeholder(s) with a real id. Returns the
 * new content and whether anything changed (so callers can warn when the id was
 * already filled in).
 */
export function applyD1Id(
  wranglerJsonc: string,
  databaseId: string,
): { content: string; changed: boolean } {
  const content = wranglerJsonc.replaceAll("<your-d1-database-id>", databaseId);
  return { content, changed: content !== wranglerJsonc };
}

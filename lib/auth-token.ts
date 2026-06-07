import { eq } from "drizzle-orm";

import type { Viewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  personalAccessToken,
  user as userTable,
  type TokenScope,
} from "@/lib/db/schema";

// Namespaces the token (mirrors the "seeder" cookie prefix) and helps secret
// scanners flag a leaked value. Verification cheaply rejects anything without it.
export const TOKEN_PREFIX = "seed_pat_";

/**
 * Mint a new raw token. The raw value is shown to the user exactly once and is
 * never stored — only its SHA-256 hash (see {@link hashToken}) and a short
 * display prefix go to the DB. 32 random bytes → 256 bits of entropy, base64url.
 * Matches the repo's existing high-entropy token recipe (generateShareToken).
 */
export function generateToken(): { raw: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = `${TOKEN_PREFIX}${Buffer.from(bytes).toString("base64url")}`;
  return { raw, prefix: raw.slice(0, TOKEN_PREFIX.length + 6) };
}

/**
 * SHA-256 (hex) of the full raw token, via Web Crypto (available on Workers).
 * Plain SHA-256 with no salt is correct here: the input is a 256-bit uniformly
 * random secret (not a low-entropy password), so it is not brute-forceable, and
 * a salt would break the by-hash unique-index lookup.
 */
export async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type TokenAuth = { viewer: Viewer; scope: TokenScope };

/**
 * Resolve a bearer token on an incoming request to the SAME {@link Viewer} shape
 * `getViewer()` returns, plus the token's scope. The token-world analogue of
 * `getViewer()` — every existing authz helper (canAccessProject, isAdminTier,
 * visibleProjectClause) works unchanged against the returned viewer.
 *
 * Header-only by design: it never reads the session cookie, so a browser cookie
 * can never silently authorize a token-scoped call. Returns null (caller sends
 * 401) for any missing/invalid/expired/revoked token or deactivated user.
 */
export async function getViewerFromToken(
  request: Request,
): Promise<TokenAuth | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw.startsWith(TOKEN_PREFIX)) return null;

  const db = getDb();
  // Look up BY hash (not id) so a probe never reveals which prefixes exist.
  const [row] = await db
    .select({
      tokenId: personalAccessToken.id,
      scope: personalAccessToken.scope,
      expiresAt: personalAccessToken.expiresAt,
      revokedAt: personalAccessToken.revokedAt,
      lastUsedAt: personalAccessToken.lastUsedAt,
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      image: userTable.image,
      disabledAt: userTable.disabledAt,
    })
    .from(personalAccessToken)
    .innerJoin(userTable, eq(userTable.id, personalAccessToken.userId))
    .where(eq(personalAccessToken.tokenHash, await hashToken(raw)))
    .limit(1);

  if (!row) return null;
  // Fail closed on every disqualifier.
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;
  // Deactivated users are logged-out everywhere — their tokens die with them.
  // getViewer enforces this on the cookie path; replicate it here.
  if (row.disabledAt) return null;

  // Advisory last-used stamp, throttled to ~once / 5 min so a chatty MCP client
  // doesn't cost one D1 write per call. Non-fatal — never let it fail the request.
  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > 5 * 60 * 1000) {
    try {
      await db
        .update(personalAccessToken)
        .set({ lastUsedAt: new Date(now) })
        .where(eq(personalAccessToken.id, row.tokenId));
    } catch {
      // ignore — last-used is best-effort
    }
  }

  return {
    viewer: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      image: row.image,
    },
    scope: row.scope,
  };
}

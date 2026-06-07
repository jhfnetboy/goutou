import { desc, eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/lib/db";
import { personalAccessToken, type TokenScope } from "@/lib/db/schema";

export type TokenStatus = "active" | "expired" | "revoked";

export type TokenListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: TokenScope;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  // Derived server-side (lazily, same as verify-time) so the client never has
  // to call Date.now() during render.
  status: TokenStatus;
};

/**
 * A user's own tokens, newest first. Never selects token_hash — only the
 * non-secret metadata the settings UI needs. Request-cached like the other
 * read helpers.
 */
export const getMyTokens = cache(
  async (userId: string): Promise<TokenListItem[]> => {
    const db = getDb();
    const rows = await db
      .select({
        id: personalAccessToken.id,
        name: personalAccessToken.name,
        tokenPrefix: personalAccessToken.tokenPrefix,
        scope: personalAccessToken.scope,
        lastUsedAt: personalAccessToken.lastUsedAt,
        expiresAt: personalAccessToken.expiresAt,
        revokedAt: personalAccessToken.revokedAt,
        createdAt: personalAccessToken.createdAt,
      })
      .from(personalAccessToken)
      .where(eq(personalAccessToken.userId, userId))
      .orderBy(desc(personalAccessToken.createdAt));

    const now = Date.now();
    return rows.map((row) => ({
      ...row,
      status: row.revokedAt
        ? "revoked"
        : row.expiresAt && row.expiresAt.getTime() <= now
          ? "expired"
          : "active",
    }));
  },
);

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireViewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { personalAccessToken } from "@/lib/db/schema";

// Soft-revoke (set revoked_at) one of the viewer's own tokens. Soft, not delete,
// so last_used_at survives for the user's own audit. Idempotent.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const viewer = await requireViewer();
  const { tokenId } = await params;

  const db = getDb();
  const [token] = await db
    .select({
      id: personalAccessToken.id,
      userId: personalAccessToken.userId,
      revokedAt: personalAccessToken.revokedAt,
    })
    .from(personalAccessToken)
    .where(eq(personalAccessToken.id, tokenId))
    .limit(1);

  // 404 (not 403) when it isn't the viewer's token — don't reveal existence.
  if (!token || token.userId !== viewer.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!token.revokedAt) {
    const now = new Date();
    await db
      .update(personalAccessToken)
      .set({ revokedAt: now, updatedAt: now })
      .where(eq(personalAccessToken.id, tokenId));
  }

  revalidatePath("/settings/tokens");
  return Response.json({ ok: true });
}

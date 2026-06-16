import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireViewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { personalAccessToken } from "@/lib/db/schema";

// Revoke = hard-delete one of the viewer's own tokens. The row is removed
// entirely rather than soft-flagged with revoked_at, so revoked tokens don't
// linger in the list. Verification (lib/auth-token) then fails on "not found".
// Idempotent: revoking an already-deleted token still returns ok.
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
    })
    .from(personalAccessToken)
    .where(eq(personalAccessToken.id, tokenId))
    .limit(1);

  // 404 (not 403) when it isn't the viewer's token — don't reveal existence.
  if (!token || token.userId !== viewer.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .delete(personalAccessToken)
    .where(eq(personalAccessToken.id, tokenId));

  revalidatePath("/settings/tokens");
  return Response.json({ ok: true });
}

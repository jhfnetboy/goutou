import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth-server";
import { generateToken, hashToken } from "@/lib/auth-token";
import { getMyTokens } from "@/lib/data-tokens";
import { getDb } from "@/lib/db";
import { personalAccessToken, tokenScopeValues } from "@/lib/db/schema";

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scope: z.enum(tokenScopeValues).default("read"),
  // Optional expiry; default no-expiry. 1..365 days.
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

const MS_PER_DAY = 86_400_000;

// List the viewer's own tokens (metadata only — never the hash/raw value).
export async function GET() {
  const viewer = await requireViewer();
  return Response.json({ tokens: await getMyTokens(viewer.id) });
}

// Mint a new token for the viewer. Any member may mint read or readwrite — a
// token is always bounded by that user's own project access.
export async function POST(request: Request) {
  const viewer = await requireViewer();

  let payload: z.infer<typeof createTokenSchema>;
  try {
    payload = createTokenSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const { raw, prefix } = generateToken();
  const now = new Date();
  const id = crypto.randomUUID();
  const expiresAt = payload.expiresInDays
    ? new Date(now.getTime() + payload.expiresInDays * MS_PER_DAY)
    : null;

  await getDb()
    .insert(personalAccessToken)
    .values({
      id,
      userId: viewer.id,
      name: payload.name,
      tokenHash: await hashToken(raw),
      tokenPrefix: prefix,
      scope: payload.scope,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

  revalidatePath("/settings/tokens");
  // `token` is the only time the raw value is ever returned. The client must
  // surface it immediately; it cannot be recovered later.
  return Response.json({
    ok: true,
    id,
    token: raw,
    prefix,
    scope: payload.scope,
    expiresAt,
  });
}

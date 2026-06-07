import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { invitations, userRoleValues } from "@/lib/db/schema";

const createInviteSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(userRoleValues).default("member"),
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export async function POST(request: Request) {
  const viewer = await requireRole(["owner", "admin"]);

  let payload: z.infer<typeof createInviteSchema>;
  try {
    payload = createInviteSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  // Owners-only can mint admin invites; admins can only invite members.
  if (payload.role !== "member" && viewer.role !== "owner") {
    return Response.json(
      { error: "Only owners can invite admins or owners." },
      { status: 403 },
    );
  }
  if (payload.role === "owner") {
    return Response.json(
      { error: "Cannot invite another owner." },
      { status: 403 },
    );
  }

  const db = getDb();
  const now = new Date();

  // Revoke any prior un-accepted invite for this email so only the newest token
  // is ever valid — avoids unbounded duplicate pending invites and stale tokens
  // that survive a "revoke" of a different row.
  await db
    .delete(invitations)
    .where(
      and(eq(invitations.email, payload.email), isNull(invitations.acceptedAt)),
    );

  const id = crypto.randomUUID();
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  await db.insert(invitations).values({
    id,
    email: payload.email,
    role: payload.role,
    invitedById: viewer.id,
    token,
    expiresAt,
    createdAt: now,
  });

  revalidatePath("/admin/invites");

  return Response.json({ ok: true, id, token });
}

export async function DELETE(request: Request) {
  const viewer = await requireRole(["owner", "admin"]);
  void viewer;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDb();
  await db.delete(invitations).where(eq(invitations.id, id));

  revalidatePath("/admin/invites");

  return Response.json({ ok: true });
}

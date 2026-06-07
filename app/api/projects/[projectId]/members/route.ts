import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth-server";
import { canManageProjectMembers } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { projectMembers, projects, user } from "@/lib/db/schema";

const addMemberSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
});

type RouteParams = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const viewer = await requireViewer();
  const { projectId } = await params;

  if (!(await canManageProjectMembers(viewer, projectId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  let payload: z.infer<typeof addMemberSchema>;
  try {
    payload = addMemberSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, payload.email))
    .limit(1);
  if (!target) {
    return Response.json(
      { error: "No user with that email. Invite them first." },
      { status: 404 },
    );
  }

  // Idempotent: skip if already a member.
  const [existing] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, target.id),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: target.id,
      addedById: viewer.id,
      createdAt: new Date(),
    });
  }

  revalidatePath(`/projects/${projectId}/settings/members`);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const viewer = await requireViewer();
  const { projectId } = await params;

  if (!(await canManageProjectMembers(viewer, projectId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    );

  revalidatePath(`/projects/${projectId}/settings/members`);
  return Response.json({ ok: true });
}

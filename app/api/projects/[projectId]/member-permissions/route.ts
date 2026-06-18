import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireViewer } from "@/lib/auth-server";
import { canManageProject, resolveMemberPermissions } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";

// Save the per-project "Member Access" toggles. Editing them is Leader-level
// (canManageProject = owner / leader / workspace admin) — a Member can never
// widen their own access. Unknown keys / bad types are dropped by
// resolveMemberPermissions, which also canonicalizes the stored value to a full
// map merged over the code defaults.
const bodySchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const viewer = await requireViewer();
  const { projectId } = await params;

  if (!(await canManageProject(viewer, projectId))) {
    return NextResponse.json(
      { error: "Only the project owner, a leader, or an admin can change Member Access." },
      { status: 403 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const resolved = resolveMemberPermissions(JSON.stringify(body.permissions));
  const db = getDb();
  await db
    .update(projects)
    .set({ memberPermissions: JSON.stringify(resolved) })
    .where(eq(projects.id, projectId));

  revalidatePath(`/projects/${projectId}/settings/members`);
  return NextResponse.json({ ok: true });
}

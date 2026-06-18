import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth-server";
import {
  addProjectMember,
  removeProjectMember,
  setProjectMemberRole,
} from "@/lib/services/members";
import { projectMemberRoleValues } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ projectId: string }> };

const addSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(projectMemberRoleValues).optional(),
});
const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(projectMemberRoleValues),
});

// Service errors are surfaced verbatim to the toast; authz uses an opaque
// "Project not found." so a probe can't tell a missing project from a forbidden
// one. Return 400 with the message rather than leaking a 403/404 distinction.
function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not update members.";
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(request: Request, { params }: RouteParams) {
  const viewer = await requireViewer();
  const { projectId } = await params;

  let payload: z.infer<typeof addSchema>;
  try {
    payload = addSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await addProjectMember(viewer, {
      projectId,
      email: payload.email,
      role: payload.role ?? "member",
    });
  } catch (error) {
    return errorResponse(error);
  }

  revalidatePath(`/projects/${projectId}/settings/members`);
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const viewer = await requireViewer();
  const { projectId } = await params;

  let payload: z.infer<typeof roleSchema>;
  try {
    payload = roleSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await setProjectMemberRole(viewer, {
      projectId,
      userId: payload.userId,
      role: payload.role,
    });
  } catch (error) {
    return errorResponse(error);
  }

  revalidatePath(`/projects/${projectId}/settings/members`);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    await removeProjectMember(viewer, { projectId, userId });
  } catch (error) {
    return errorResponse(error);
  }

  revalidatePath(`/projects/${projectId}/settings/members`);
  return Response.json({ ok: true });
}

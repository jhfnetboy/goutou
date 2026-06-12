// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daniel Syauqi and Thaqif Rosdi

// Membership + workspace-invitation services — shared by the web API routes
// (app/api/projects/[projectId]/members, app/api/admin/invites) and the MCP
// server. Each takes a Viewer + typed input, performs the authz check + DB
// mutation, and returns a plain result (no Response / revalidatePath). The
// authz here matches the web exactly: project owner or admin-tier to manage
// members; admin-tier (owner-only for admin invites) for workspace invites.
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { isAdminTier, type Viewer } from "@/lib/auth-server";
import { canAccessProject, canManageProjectMembers } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  invitations,
  projectMembers,
  projects,
  user,
  userRoleValues,
} from "@/lib/db/schema";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// --- Input schemas -----------------------------------------------------------

export const listProjectMembersInputSchema = z.object({
  projectId: z.string().min(1),
});
export type ListProjectMembersInput = z.infer<
  typeof listProjectMembersInputSchema
>;

// Kept as a plain object (no top-level .refine) so MCP's registerTool can read
// its .shape; the "email or userId required" rule is enforced in the service.
export const addProjectMemberInputSchema = z.object({
  projectId: z.string().min(1),
  email: z
    .email()
    .transform((v) => v.toLowerCase())
    .optional()
    .describe("Email of an existing workspace user to add."),
  userId: z
    .string()
    .min(1)
    .optional()
    .describe("Id of an existing workspace user to add (alternative to email)."),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberInputSchema>;

export const removeProjectMemberInputSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
});
export type RemoveProjectMemberInput = z.infer<
  typeof removeProjectMemberInputSchema
>;

export const createInviteInputSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  role: z
    .enum(userRoleValues)
    .default("member")
    .describe("Workspace role for the invitee: member or admin (owners can't be invited)."),
});
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;

export const revokeInviteInputSchema = z.object({
  inviteId: z.string().min(1),
});
export type RevokeInviteInput = z.infer<typeof revokeInviteInputSchema>;

// --- Members -----------------------------------------------------------------

type ProjectMemberRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  isOwner: boolean;
  addedAt: Date | null;
};

export async function listProjectMembers(
  viewer: Viewer,
  input: ListProjectMembersInput,
): Promise<ProjectMemberRow[]> {
  const db = getDb();
  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) throw new Error("Project not found.");
  if (!(await canAccessProject(viewer, input.projectId))) {
    throw new Error("Project not found.");
  }

  const [ownerRows, memberRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, project.ownerId))
      .limit(1),
    db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        addedAt: projectMembers.createdAt,
      })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, input.projectId))
      .orderBy(desc(projectMembers.createdAt)),
  ]);

  const result: ProjectMemberRow[] = [];
  if (ownerRows[0]) {
    result.push({
      userId: ownerRows[0].id,
      name: ownerRows[0].name,
      email: ownerRows[0].email,
      role: ownerRows[0].role,
      image: ownerRows[0].image,
      isOwner: true,
      addedAt: null,
    });
  }
  for (const m of memberRows) {
    // The owner is tracked on the project row, not project_members; skip a
    // defensive duplicate if both ever exist.
    if (m.userId === project.ownerId) continue;
    result.push({
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      image: m.image,
      isOwner: false,
      addedAt: m.addedAt,
    });
  }
  return result;
}

export async function addProjectMember(
  viewer: Viewer,
  input: AddProjectMemberInput,
): Promise<{ projectId: string; userId: string; added: boolean }> {
  const db = getDb();

  if (!input.userId && !input.email) {
    throw new Error("Provide an email or a userId of the person to add.");
  }
  if (!(await canManageProjectMembers(viewer, input.projectId))) {
    throw new Error("You don't have permission to manage members on this project.");
  }

  const [project] = await db
    .select({ id: projects.id, ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) throw new Error("Project not found.");

  // Resolve the target by id or email; both must be an existing workspace user
  // (brand-new people are brought in via createInvite first).
  const [target] = input.userId
    ? await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1)
    : await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email!))
        .limit(1);
  if (!target) {
    throw new Error("No user with that email or id. Invite them first.");
  }

  if (target.id === project.ownerId) {
    // The owner already has full access; adding a membership row is a no-op.
    return { projectId: input.projectId, userId: target.id, added: false };
  }

  const [existing] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, target.id),
      ),
    )
    .limit(1);

  if (existing) {
    return { projectId: input.projectId, userId: target.id, added: false };
  }

  await db.insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    userId: target.id,
    addedById: viewer.id,
    createdAt: new Date(),
  });

  return { projectId: input.projectId, userId: target.id, added: true };
}

export async function removeProjectMember(
  viewer: Viewer,
  input: RemoveProjectMemberInput,
): Promise<{ projectId: string; userId: string }> {
  const db = getDb();

  if (!(await canManageProjectMembers(viewer, input.projectId))) {
    throw new Error("You don't have permission to manage members on this project.");
  }

  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, input.userId),
      ),
    );

  return { projectId: input.projectId, userId: input.userId };
}

// --- Workspace invitations ---------------------------------------------------

export async function createInvite(
  viewer: Viewer,
  input: CreateInviteInput,
): Promise<{
  id: string;
  email: string;
  role: (typeof userRoleValues)[number];
  token: string;
  expiresAt: Date;
  acceptPath: string;
}> {
  if (!isAdminTier(viewer.role)) {
    throw new Error("Only workspace owners and admins can create invitations.");
  }
  // Owners-only can mint admin invites; admins can only invite members.
  if (input.role !== "member" && viewer.role !== "owner") {
    throw new Error("Only owners can invite admins or owners.");
  }
  if (input.role === "owner") {
    throw new Error("Cannot invite another owner.");
  }

  const db = getDb();
  const now = new Date();

  // Revoke any prior un-accepted invite for this email so only the newest token
  // is ever valid.
  await db
    .delete(invitations)
    .where(and(eq(invitations.email, input.email), isNull(invitations.acceptedAt)));

  const id = crypto.randomUUID();
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  await db.insert(invitations).values({
    id,
    email: input.email,
    role: input.role,
    invitedById: viewer.id,
    token,
    expiresAt,
    createdAt: now,
  });

  return {
    id,
    email: input.email,
    role: input.role,
    token,
    expiresAt,
    // Share <your-domain>${acceptPath} with the invitee to let them register.
    acceptPath: `/sign-in?invite=${token}`,
  };
}

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  status: "pending" | "accepted" | "expired";
};

export async function listInvites(viewer: Viewer): Promise<InviteRow[]> {
  if (!isAdminTier(viewer.role)) {
    throw new Error("Only workspace owners and admins can list invitations.");
  }
  const db = getDb();
  const now = Date.now();
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .orderBy(desc(invitations.createdAt));

  return rows.map((row) => ({
    ...row,
    status:
      row.acceptedAt !== null
        ? ("accepted" as const)
        : row.expiresAt.getTime() < now
          ? ("expired" as const)
          : ("pending" as const),
  }));
}

export async function revokeInvite(
  viewer: Viewer,
  input: RevokeInviteInput,
): Promise<{ inviteId: string }> {
  if (!isAdminTier(viewer.role)) {
    throw new Error("Only workspace owners and admins can revoke invitations.");
  }
  const db = getDb();
  await db.delete(invitations).where(eq(invitations.id, input.inviteId));
  return { inviteId: input.inviteId };
}

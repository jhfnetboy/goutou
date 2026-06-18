// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daniel Syauqi and Thaqif Rosdi

import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/lib/db";
import {
  projectMembers,
  projects,
  type ProjectMemberRole,
  type UserRole,
} from "@/lib/db/schema";
import { isAdminTier } from "@/lib/auth-server";

type ViewerInput = { id: string; role: UserRole };

// A viewer's effective role on one project. The Owner is the project creator
// (projects.ownerId); Leader/Member come from project_members.role. Workspace
// owners/admins are super-users and resolve to "owner" for capability checks.
export type ProjectRole = "owner" | "leader" | "member";

/**
 * Projects the user has a direct relationship with — they own it OR they're
 * in project_members. Used by personal pages (/dashboard, /today, /projects
 * list, sidebar) regardless of viewer role.
 */
export const getPersonalProjectIds = cache(
  async (userId: string): Promise<string[]> => {
    const db = getDb();
    const [owned, memberOf] = await Promise.all([
      db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.ownerId, userId)),
      db
        .select({ id: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, userId)),
    ]);
    return [...new Set([...owned.map((r) => r.id), ...memberOf.map((r) => r.id)])];
  },
);

/**
 * Resource-fetch authorization. Used by single-project detail pages and
 * mutation routes. Admin tier sees everything; members see only projects
 * they're in (owned or membership). Throws/returns false if not accessible.
 */
export async function canAccessProject(
  viewer: ViewerInput,
  projectId: string,
): Promise<boolean> {
  if (isAdminTier(viewer.role)) return true;

  const db = getDb();
  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return false;
  if (project.ownerId === viewer.id) return true;

  const [member] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, viewer.id),
      ),
    )
    .limit(1);

  return Boolean(member);
}

/**
 * The viewer's effective role on a project, or null if they have no access.
 * Workspace owner/admin → "owner" (super-user); the project creator → "owner";
 * a project_members row → its stored role ("leader" | "member"); else null.
 */
export async function getProjectRole(
  viewer: ViewerInput,
  projectId: string,
): Promise<ProjectRole | null> {
  if (isAdminTier(viewer.role)) return "owner";

  const db = getDb();
  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return null;
  if (project.ownerId === viewer.id) return "owner";

  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, viewer.id),
      ),
    )
    .limit(1);
  return (member?.role as ProjectMemberRole | undefined) ?? null;
}

/**
 * Leader-level authority: edit project details, manage labels/categories/notes,
 * publish client updates, manage branches, convert requests, and add/remove
 * Members. Owner OR Leader (OR workspace admin). NOT enough to delete/archive
 * the project, manage the share link, change the project key, or set roles —
 * those require canAdministerProject.
 */
export async function canManageProject(
  viewer: ViewerInput,
  projectId: string,
): Promise<boolean> {
  const role = await getProjectRole(viewer, projectId);
  return role === "owner" || role === "leader";
}

/**
 * Owner-level authority: the structural / destructive / role-granting actions
 * a Leader can never do. Owner only (workspace admins included).
 */
export async function canAdministerProject(
  viewer: ViewerInput,
  projectId: string,
): Promise<boolean> {
  return (await getProjectRole(viewer, projectId)) === "owner";
}

/**
 * Returns the project IDs a viewer can see.
 * - Admin tier (owner/admin): every project.
 * - Member: only projects they're explicitly a member of.
 *
 * Phase 1 ships this helper; Phase 2 wires it into lib/data.ts queries.
 */
export async function visibleProjectIds(
  viewer: ViewerInput,
): Promise<string[]> {
  const db = getDb();

  if (isAdminTier(viewer.role)) {
    const rows = await db.select({ id: projects.id }).from(projects);
    return rows.map((row) => row.id);
  }

  const rows = await db
    .select({ id: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, viewer.id));
  return rows.map((row) => row.id);
}

export async function canViewProject(
  viewer: ViewerInput,
  projectId: string,
): Promise<boolean> {
  if (isAdminTier(viewer.role)) return true;

  const db = getDb();
  const [row] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, viewer.id),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function canEditProject(
  viewer: ViewerInput,
  projectId: string,
): Promise<boolean> {
  // Project config edits are Leader-level (owner or leader).
  return canManageProject(viewer, projectId);
}

/**
 * Authority to add/remove members on a project — now Leader-level (owner or
 * leader, plus workspace admins). The finer rules (only the Owner may grant or
 * remove the Leader role; a Leader can only manage Members) live in the member
 * service, which knows each target's role.
 */
export async function canManageProjectMembers(
  viewer: ViewerInput,
  projectId: string,
): Promise<boolean> {
  return canManageProject(viewer, projectId);
}

/**
 * Filter helper for queries that need to scope by visible project IDs.
 * Returns a Drizzle clause: `projects.id IN (...visibleIds)`.
 * Returns null if the viewer can see nothing (caller should short-circuit).
 */
export async function visibleProjectClause(viewer: ViewerInput) {
  if (isAdminTier(viewer.role)) return null; // null = no filter needed
  const ids = await visibleProjectIds(viewer);
  if (ids.length === 0) return inArray(projects.id, ["__none__"]); // matches nothing
  return inArray(projects.id, ids);
}

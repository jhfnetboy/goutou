// Viewer-scoped read queries for the MCP read tools. Every function is scoped
// to what the viewer can see — list helpers reuse lib/data.ts (which filters by
// getPersonalProjectIds), single-entity reads gate on canAccessProject and
// return null/[] on a miss (never throw, so they can't be used as an existence
// oracle). Output shapes are compact (no internal/sensitive fields).
import { and, asc, eq, inArray } from "drizzle-orm";

import type { Viewer } from "@/lib/auth-server";
import { canAccessProject, getPersonalProjectIds } from "@/lib/authz";
import { formatRequestCode, formatTaskCode } from "@/lib/codes";
import { getSearchIndexForUser, listProjectsForUser } from "@/lib/data";
import { getDb } from "@/lib/db";
import {
  clientRequests,
  projects,
  taskChecklistItems,
  tasks,
  type Priority,
  type ProjectStatus,
  type RequestStatus,
  type TaskStatus,
} from "@/lib/db/schema";

export type ProjectSummary = {
  id: string;
  slug: string | null;
  name: string;
  status: ProjectStatus;
  archived: boolean;
};

export type TaskSummary = {
  id: string;
  code: string | null;
  title: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string;
  assigneeId: string | null;
  dueDate: string | null;
};

export type TaskDetail = TaskSummary & {
  description: string | null;
  category: { id: string; name: string } | null;
  checklist: { id: string; content: string; isCompleted: boolean }[];
};

export type RequestSummary = {
  id: string;
  code: string | null;
  title: string;
  status: RequestStatus;
  priority: Priority;
  projectId: string;
};

export type RequestDetail = RequestSummary & {
  description: string | null;
  createdAt: string;
};

export type SearchHit = {
  type: "project" | "task" | "request";
  id: string;
  code: string | null;
  title: string;
  projectId: string;
};

const MAX_ROWS = 100;

/** projectId → slug, for formatting display codes in list results. */
async function slugMap(
  projectIds: string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(inArray(projects.id, ids));
  return new Map(rows.map((row) => [row.id, row.slug]));
}

export async function listProjects(
  viewer: Viewer,
  opts?: { includeArchived?: boolean; onlyArchived?: boolean },
): Promise<ProjectSummary[]> {
  const rows = await listProjectsForUser(viewer.id, opts);
  return rows.slice(0, MAX_ROWS).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    archived: Boolean(p.archivedAt),
  }));
}

export async function listTasks(
  viewer: Viewer,
  filter?: { projectId?: string; status?: TaskStatus; assignedToMe?: boolean },
): Promise<TaskSummary[]> {
  const db = getDb();
  let scopeIds: string[];
  if (filter?.projectId) {
    // A specific project the viewer can access (member or admin).
    if (!(await canAccessProject(viewer, filter.projectId))) return [];
    scopeIds = [filter.projectId];
  } else {
    // Personal scope: projects the viewer owns or is a member of.
    scopeIds = await getPersonalProjectIds(viewer.id);
  }
  if (scopeIds.length === 0) return [];
  let rows = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.projectId, scopeIds));
  if (filter?.status) {
    rows = rows.filter((t) => t.status === filter.status);
  }
  if (filter?.assignedToMe) {
    rows = rows.filter((t) => t.assigneeId === viewer.id);
  }
  const capped = rows.slice(0, MAX_ROWS);
  const slugs = await slugMap(capped.map((t) => t.projectId));
  return capped.map((t) => ({
    id: t.id,
    code: formatTaskCode(slugs.get(t.projectId) ?? null, t.codeNumber),
    title: t.title,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId,
    assigneeId: t.assigneeId,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));
}

export async function readTask(
  viewer: Viewer,
  input: { projectId: string; taskId: string },
): Promise<TaskDetail | null> {
  if (!(await canAccessProject(viewer, input.projectId))) return null;
  const db = getDb();
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, input.projectId)))
    .limit(1);
  if (!task) return null;

  const checklist = await db
    .select({
      id: taskChecklistItems.id,
      content: taskChecklistItems.content,
      isCompleted: taskChecklistItems.isCompleted,
    })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, input.taskId))
    .orderBy(asc(taskChecklistItems.sortOrder))
    .limit(MAX_ROWS);

  const slugs = await slugMap([input.projectId]);
  return {
    id: task.id,
    code: formatTaskCode(slugs.get(input.projectId) ?? null, task.codeNumber),
    title: task.title,
    status: task.status,
    priority: task.priority,
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    description: task.description,
    category: task.categoryId
      ? { id: task.categoryId, name: task.categoryName ?? "" }
      : null,
    checklist,
  };
}

export async function listRequests(
  viewer: Viewer,
  filter?: { projectId?: string; status?: RequestStatus },
): Promise<RequestSummary[]> {
  const db = getDb();
  let scopeIds: string[];
  if (filter?.projectId) {
    if (!(await canAccessProject(viewer, filter.projectId))) return [];
    scopeIds = [filter.projectId];
  } else {
    scopeIds = await getPersonalProjectIds(viewer.id);
  }
  if (scopeIds.length === 0) return [];
  let rows = await db
    .select()
    .from(clientRequests)
    .where(inArray(clientRequests.projectId, scopeIds));
  if (filter?.status) {
    rows = rows.filter((r) => r.status === filter.status);
  }
  const capped = rows.slice(0, MAX_ROWS);
  const slugs = await slugMap(capped.map((r) => r.projectId));
  return capped.map((r) => ({
    id: r.id,
    code: formatRequestCode(slugs.get(r.projectId) ?? null, r.codeNumber),
    title: r.title,
    status: r.status,
    priority: r.priority,
    projectId: r.projectId,
  }));
}

export async function readRequest(
  viewer: Viewer,
  input: { projectId: string; requestId: string },
): Promise<RequestDetail | null> {
  if (!(await canAccessProject(viewer, input.projectId))) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientRequests)
    .where(
      and(
        eq(clientRequests.id, input.requestId),
        eq(clientRequests.projectId, input.projectId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const slugs = await slugMap([input.projectId]);
  return {
    id: row.id,
    code: formatRequestCode(slugs.get(input.projectId) ?? null, row.codeNumber),
    title: row.title,
    status: row.status,
    priority: row.priority,
    projectId: row.projectId,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function search(
  viewer: Viewer,
  input: { query: string; limit?: number },
): Promise<SearchHit[]> {
  const q = input.query.trim().toLowerCase();
  if (!q) return [];
  const limit = Math.min(input.limit ?? 50, 100);
  // The index is built only from the viewer's owned-or-member projects.
  const index = await getSearchIndexForUser(viewer.id);
  const hits: SearchHit[] = [];
  for (const item of index) {
    if (hits.length >= limit) break;
    if (!item.searchText.toLowerCase().includes(q)) continue;
    hits.push({
      type: item.kind,
      // Index ids are prefixed "kind-<rawId>"; strip back to the entity id.
      id: item.id.slice(item.kind.length + 1),
      code: item.code,
      title: item.title,
      projectId: item.projectId,
    });
  }
  return hits;
}

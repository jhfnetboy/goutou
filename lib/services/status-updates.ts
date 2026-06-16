// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daniel Syauqi and Thaqif Rosdi

// Task status-update (client-facing summary) service — shared by the web Server
// Actions (lib/actions.ts) and the MCP server. Viewer + typed input → owner-only
// write + activity logging; no revalidate/redirect/FormData. There is exactly
// one published update per task (unique index on task_id), so publish is an
// INSERT … ON CONFLICT DO UPDATE. Authz mirrors the web exactly: the actor must
// own BOTH the task and the project, and only a task whose status is "done" can
// be published. The summary is plain text, so it is stored verbatim.
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { logProjectActivity } from "@/lib/activity";
import type { Viewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { projectStatusUpdates, tasks } from "@/lib/db/schema";
import {
  assertProjectOwner,
  touchProject,
  touchTask,
} from "@/lib/services/_shared";

const STATUS_UPDATE_MAX = 5000;

export const publishStatusUpdateInputSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  summary: z
    .string()
    .trim()
    .min(1)
    .max(STATUS_UPDATE_MAX)
    .describe("Plain-text client-facing summary of what was completed."),
});
export type PublishStatusUpdateInput = z.infer<
  typeof publishStatusUpdateInputSchema
>;

export const deleteStatusUpdateInputSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
});
export type DeleteStatusUpdateInput = z.infer<
  typeof deleteStatusUpdateInputSchema
>;

/** Load a task the viewer owns within the project, or throw (opaque). */
async function assertOwnedTask(viewer: Viewer, taskId: string, projectId: string) {
  const db = getDb();
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.projectId, projectId),
        eq(tasks.ownerId, viewer.id),
      ),
    )
    .limit(1);
  if (!task) throw new Error("Task not found.");
  return task;
}

export async function publishStatusUpdate(
  viewer: Viewer,
  input: PublishStatusUpdateInput,
): Promise<{ taskId: string }> {
  const db = getDb();
  const now = new Date();
  const task = await assertOwnedTask(viewer, input.taskId, input.projectId);
  await assertProjectOwner(viewer, input.projectId);

  if (task.status !== "done") {
    throw new Error("Only completed tasks can be published as client updates.");
  }

  await db
    .insert(projectStatusUpdates)
    .values({
      id: crypto.randomUUID(),
      ownerId: viewer.id,
      projectId: input.projectId,
      taskId: input.taskId,
      summary: input.summary,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projectStatusUpdates.taskId,
      set: { summary: input.summary, updatedAt: now },
    });

  await Promise.all([
    touchTask(input.taskId, now),
    touchProject(input.projectId, now),
  ]);

  await logProjectActivity(db, {
    ownerId: viewer.id,
    projectId: input.projectId,
    entityType: "task",
    entityId: input.taskId,
    action: "updated",
    label: "Published client update",
    detail: task.title,
    createdAt: now,
  });

  return { taskId: input.taskId };
}

export async function deleteStatusUpdate(
  viewer: Viewer,
  input: DeleteStatusUpdateInput,
): Promise<{ taskId: string }> {
  const db = getDb();
  const now = new Date();
  const task = await assertOwnedTask(viewer, input.taskId, input.projectId);
  await assertProjectOwner(viewer, input.projectId);

  await db
    .delete(projectStatusUpdates)
    .where(
      and(
        eq(projectStatusUpdates.taskId, input.taskId),
        eq(projectStatusUpdates.ownerId, viewer.id),
      ),
    );

  await Promise.all([
    touchTask(input.taskId, now),
    touchProject(input.projectId, now),
  ]);

  await logProjectActivity(db, {
    ownerId: viewer.id,
    projectId: input.projectId,
    entityType: "task",
    entityId: input.taskId,
    action: "updated",
    label: "Removed client update",
    detail: task.title,
    createdAt: now,
  });

  return { taskId: input.taskId };
}

// Task checklist (subtask) mutation services — shared by the web route and the
// MCP server. Viewer + typed input → DB mutation + activity logging; no
// revalidate/redirect/FormData. Moved verbatim from the workspace route.
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { logProjectActivity } from "@/lib/activity";
import { diffChanges } from "@/lib/activity-diff";
import type { Viewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { taskChecklistItems } from "@/lib/db/schema";
import {
  assertProjectCapability,
  assertTaskInProject,
  checklistExcerpt,
  getNextChecklistSortOrder,
  touchProject,
  touchTask,
} from "@/lib/services/_shared";

export const createChecklistItemInputSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  content: z.string().trim().min(1).max(180),
});
export type CreateChecklistItemInput = z.infer<
  typeof createChecklistItemInputSchema
>;

export const toggleChecklistItemInputSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  checklistItemId: z.string().min(1),
});
export type ToggleChecklistItemInput = z.infer<
  typeof toggleChecklistItemInputSchema
>;

export const updateChecklistItemInputSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  checklistItemId: z.string().min(1),
  content: z.string().trim().min(1).max(180),
});
export type UpdateChecklistItemInput = z.infer<
  typeof updateChecklistItemInputSchema
>;

export const deleteChecklistItemInputSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  checklistItemId: z.string().min(1),
});
export type DeleteChecklistItemInput = z.infer<
  typeof deleteChecklistItemInputSchema
>;

export async function createChecklistItem(
  viewer: Viewer,
  input: CreateChecklistItemInput,
): Promise<{
  item: {
    id: string;
    taskId: string;
    content: string;
    isCompleted: false;
    sortOrder: number;
  };
}> {
  const db = getDb();
  const now = new Date();
  await assertProjectCapability(viewer, input.projectId, "checklist.write");
  await assertTaskInProject(input.taskId, input.projectId);

  const itemId = crypto.randomUUID();
  const sortOrder = await getNextChecklistSortOrder(input.taskId);

  await db.insert(taskChecklistItems).values({
    id: itemId,
    ownerId: viewer.id,
    projectId: input.projectId,
    taskId: input.taskId,
    content: input.content,
    isCompleted: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
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
    action: "created",
    label: "Added subtask",
    detail: checklistExcerpt(input.content),
    createdAt: now,
  });

  return {
    item: {
      id: itemId,
      taskId: input.taskId,
      content: input.content,
      isCompleted: false,
      sortOrder,
    },
  };
}

export async function toggleChecklistItem(
  viewer: Viewer,
  input: ToggleChecklistItemInput,
): Promise<{ item: { id: string; isCompleted: boolean } }> {
  const db = getDb();
  const now = new Date();
  await assertProjectCapability(viewer, input.projectId, "checklist.write");
  await assertTaskInProject(input.taskId, input.projectId);

  const [existingItem] = await db
    .select()
    .from(taskChecklistItems)
    .where(
      and(
        eq(taskChecklistItems.id, input.checklistItemId),
        eq(taskChecklistItems.taskId, input.taskId),
      ),
    )
    .limit(1);

  if (!existingItem) {
    throw new Error("Checklist item not found.");
  }

  const isCompleted = !existingItem.isCompleted;

  await db
    .update(taskChecklistItems)
    .set({
      isCompleted,
      completedAt: isCompleted ? now : null,
      updatedAt: now,
    })
    .where(eq(taskChecklistItems.id, input.checklistItemId));

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
    label: isCompleted ? "Completed subtask" : "Reopened subtask",
    detail: checklistExcerpt(existingItem.content),
    changes: diffChanges([
      {
        field: "state",
        label: "Subtask",
        from: existingItem.isCompleted ? "Done" : "Open",
        to: isCompleted ? "Done" : "Open",
      },
    ]),
    createdAt: now,
  });

  return { item: { id: input.checklistItemId, isCompleted } };
}

export async function updateChecklistItem(
  viewer: Viewer,
  input: UpdateChecklistItemInput,
): Promise<{ item: { id: string; content: string } }> {
  const db = getDb();
  const now = new Date();
  await assertProjectCapability(viewer, input.projectId, "checklist.write");
  await assertTaskInProject(input.taskId, input.projectId);

  const [existingItem] = await db
    .select({ content: taskChecklistItems.content })
    .from(taskChecklistItems)
    .where(
      and(
        eq(taskChecklistItems.id, input.checklistItemId),
        eq(taskChecklistItems.taskId, input.taskId),
      ),
    )
    .limit(1);

  const result = await db
    .update(taskChecklistItems)
    .set({
      content: input.content,
      updatedAt: now,
    })
    .where(
      and(
        eq(taskChecklistItems.id, input.checklistItemId),
        eq(taskChecklistItems.taskId, input.taskId),
      ),
    )
    .returning({ id: taskChecklistItems.id });

  if (result.length === 0) {
    throw new Error("Checklist item not found.");
  }

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
    label: "Renamed subtask",
    detail: checklistExcerpt(input.content),
    changes: diffChanges([
      {
        field: "content",
        label: "Subtask",
        from: existingItem?.content ?? null,
        to: input.content,
      },
    ]),
    createdAt: now,
  });

  return { item: { id: input.checklistItemId, content: input.content } };
}

export async function deleteChecklistItem(
  viewer: Viewer,
  input: DeleteChecklistItemInput,
): Promise<{ checklistItemId: string }> {
  const db = getDb();
  const now = new Date();
  await assertProjectCapability(viewer, input.projectId, "checklist.write");
  await assertTaskInProject(input.taskId, input.projectId);

  const [removedItem] = await db
    .select({ content: taskChecklistItems.content })
    .from(taskChecklistItems)
    .where(
      and(
        eq(taskChecklistItems.id, input.checklistItemId),
        eq(taskChecklistItems.taskId, input.taskId),
      ),
    )
    .limit(1);

  await db
    .delete(taskChecklistItems)
    .where(
      and(
        eq(taskChecklistItems.id, input.checklistItemId),
        eq(taskChecklistItems.taskId, input.taskId),
      ),
    );

  await Promise.all([
    touchTask(input.taskId, now),
    touchProject(input.projectId, now),
  ]);

  if (removedItem) {
    await logProjectActivity(db, {
      ownerId: viewer.id,
      projectId: input.projectId,
      entityType: "task",
      entityId: input.taskId,
      action: "deleted",
      label: "Removed subtask",
      detail: checklistExcerpt(removedItem.content),
      createdAt: now,
    });
  }

  return { checklistItemId: input.checklistItemId };
}

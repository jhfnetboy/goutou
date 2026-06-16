// Client-request mutation services — shared by the web route and the MCP
// server. Viewer + typed input → DB mutation + activity logging; no
// revalidate/redirect/FormData. Moved verbatim from the workspace route.
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { toActivityRow } from "@/lib/activity";
import { diffChanges, priorityLabel, requestStatusLabel } from "@/lib/activity-diff";
import type { Viewer } from "@/lib/auth-server";
import { formatRequestCode } from "@/lib/codes";
import { getDb } from "@/lib/db";
import {
  clientRequests,
  priorityValues,
  projectActivity,
  projects,
  requestStatusValues,
} from "@/lib/db/schema";
import { normalizeRichTextInput } from "@/lib/rich-text";
import {
  assertProjectAccess,
  getProjectSlug,
  isUniqueConstraintError,
  nextRequestCodeNumber,
  optionalText,
} from "@/lib/services/_shared";

const descriptionField = optionalText.describe(
  "Request description. Markdown is accepted (headings, bold/italic, lists, links, `code`, fenced code blocks, tables) and converted to rich text.",
);

export const createRequestInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(140),
  description: descriptionField,
  priority: z.enum(priorityValues).default("medium"),
});
export type CreateRequestInput = z.infer<typeof createRequestInputSchema>;

export const updateRequestInputSchema = z.object({
  requestId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(140),
  description: descriptionField,
  status: z.enum(requestStatusValues),
  priority: z.enum(priorityValues),
});
export type UpdateRequestInput = z.infer<typeof updateRequestInputSchema>;

export const deleteRequestInputSchema = z.object({
  requestId: z.string().min(1),
  projectId: z.string().min(1),
});
export type DeleteRequestInput = z.infer<typeof deleteRequestInputSchema>;

export async function createRequest(
  viewer: Viewer,
  input: CreateRequestInput,
): Promise<{ requestId: string }> {
  const db = getDb();
  const now = new Date();
  await assertProjectAccess(viewer, input.projectId);

  const requestId = crypto.randomUUID();
  const description = normalizeRichTextInput(input.description);
  const slug = await getProjectSlug(input.projectId);

  // Retry MAX+1 code allocation on a concurrent collision against the
  // UNIQUE(project_id, code_number) index (web + MCP can both create). The
  // insert, project touch, and activity row commit together as one D1 batch.
  for (let attempt = 0; ; attempt++) {
    const codeNumber = await nextRequestCodeNumber(input.projectId);
    const code = formatRequestCode(slug, codeNumber);
    try {
      await db.batch([
        db.insert(clientRequests).values({
          id: requestId,
          ownerId: viewer.id,
          projectId: input.projectId,
          title: input.title,
          description: description ?? null,
          codeNumber,
          priority: input.priority,
          status: "new",
          createdAt: now,
          updatedAt: now,
        }),
        db.update(projects).set({ updatedAt: now }).where(eq(projects.id, input.projectId)),
        db.insert(projectActivity).values(
          toActivityRow({
            ownerId: viewer.id,
            projectId: input.projectId,
            entityType: "request",
            entityId: requestId,
            action: "created",
            label: "Captured request",
            detail: code ? `${code} · ${input.title}` : input.title,
            createdAt: now,
          }),
        ),
      ]);
      break;
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < 4) continue;
      throw error;
    }
  }

  return { requestId };
}

export async function updateRequest(
  viewer: Viewer,
  input: UpdateRequestInput,
): Promise<{ requestId: string }> {
  const db = getDb();
  const now = new Date();
  await assertProjectAccess(viewer, input.projectId);

  const [existingRequest] = await db
    .select()
    .from(clientRequests)
    .where(
      and(
        eq(clientRequests.id, input.requestId),
        eq(clientRequests.projectId, input.projectId),
      ),
    )
    .limit(1);

  if (!existingRequest) {
    throw new Error("Request not found.");
  }

  const description = normalizeRichTextInput(input.description);

  const changes = diffChanges([
    { field: "title", label: "Title", from: existingRequest.title, to: input.title },
    {
      field: "description",
      label: "Description",
      from: existingRequest.description,
      to: description ?? null,
      kind: "rich",
    },
    {
      field: "status",
      label: "Status",
      from: requestStatusLabel(existingRequest.status),
      to: requestStatusLabel(input.status),
    },
    {
      field: "priority",
      label: "Priority",
      from: priorityLabel(existingRequest.priority),
      to: priorityLabel(input.priority),
    },
  ]);

  // Update, project touch, and activity row commit atomically.
  await db.batch([
    db
      .update(clientRequests)
      .set({
        title: input.title,
        description: description ?? null,
        status: input.status,
        priority: input.priority,
        updatedAt: now,
      })
      .where(
        and(
          eq(clientRequests.id, input.requestId),
          eq(clientRequests.projectId, input.projectId),
        ),
      ),
    db.update(projects).set({ updatedAt: now }).where(eq(projects.id, input.projectId)),
    db.insert(projectActivity).values(
      toActivityRow({
        ownerId: viewer.id,
        projectId: input.projectId,
        entityType: "request",
        entityId: input.requestId,
        action: "updated",
        label: "Updated request",
        detail: input.title,
        changes,
        createdAt: now,
      }),
    ),
  ]);

  return { requestId: input.requestId };
}

export async function deleteRequest(
  viewer: Viewer,
  input: DeleteRequestInput,
): Promise<{ requestId: string }> {
  const db = getDb();
  const now = new Date();
  await assertProjectAccess(viewer, input.projectId);

  const [requestRow] = await db
    .select()
    .from(clientRequests)
    .where(
      and(
        eq(clientRequests.id, input.requestId),
        eq(clientRequests.projectId, input.projectId),
      ),
    )
    .limit(1);

  // Nothing matching in this project → idempotent no-op (no delete, no log).
  if (!requestRow) {
    return { requestId: input.requestId };
  }

  // Delete, project touch, and activity row commit atomically.
  await db.batch([
    db
      .delete(clientRequests)
      .where(
        and(
          eq(clientRequests.id, input.requestId),
          eq(clientRequests.projectId, input.projectId),
        ),
      ),
    db.update(projects).set({ updatedAt: now }).where(eq(projects.id, input.projectId)),
    db.insert(projectActivity).values(
      toActivityRow({
        ownerId: viewer.id,
        projectId: input.projectId,
        entityType: "request",
        entityId: input.requestId,
        action: "deleted",
        label: "Deleted request",
        detail: requestRow.title,
        createdAt: now,
      }),
    ),
  ]);

  return { requestId: input.requestId };
}

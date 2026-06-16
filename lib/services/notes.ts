// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Daniel Syauqi and Thaqif Rosdi

// Project-notes service — shared by the web Server Action (lib/actions.ts) and
// the MCP server. Viewer + typed input → owner-only upsert + activity logging;
// no revalidate/redirect/FormData. There is exactly one note per project (unique
// index on project_id), so a write is an INSERT … ON CONFLICT DO UPDATE. The
// note body is plain text (a textarea in the UI), so — unlike task/request
// descriptions — it is NOT run through the Markdown converter; it is stored
// verbatim, matching the web action.
import { eq } from "drizzle-orm";
import { z } from "zod";

import { diffChanges } from "@/lib/activity-diff";
import { logProjectActivity } from "@/lib/activity";
import type { Viewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { projectNotes } from "@/lib/db/schema";
import { assertProjectOwner, touchProject } from "@/lib/services/_shared";

export const writeProjectNoteInputSchema = z.object({
  projectId: z.string().min(1),
  content: z
    .string()
    .max(20000)
    .describe("Plain-text note body. Pass an empty string to clear the note."),
});
export type WriteProjectNoteInput = z.infer<typeof writeProjectNoteInputSchema>;

export async function writeProjectNote(
  viewer: Viewer,
  input: WriteProjectNoteInput,
): Promise<{ projectId: string }> {
  const db = getDb();
  const now = new Date();
  await assertProjectOwner(viewer, input.projectId);

  const [existingNote] = await db
    .select({ content: projectNotes.content })
    .from(projectNotes)
    .where(eq(projectNotes.projectId, input.projectId))
    .limit(1);

  await db
    .insert(projectNotes)
    .values({
      id: crypto.randomUUID(),
      ownerId: viewer.id,
      projectId: input.projectId,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projectNotes.projectId,
      set: { content: input.content, ownerId: viewer.id, updatedAt: now },
    });

  const changes = diffChanges([
    {
      field: "content",
      label: "Notes",
      from: existingNote?.content ?? null,
      to: input.content,
      kind: "rich",
    },
  ]);

  await touchProject(input.projectId, now);
  await logProjectActivity(db, {
    ownerId: viewer.id,
    projectId: input.projectId,
    entityType: "note",
    entityId: input.projectId,
    action: "updated",
    label: "Updated notes",
    detail: input.content.trim()
      ? "Project notes changed"
      : "Cleared project notes",
    changes,
    createdAt: now,
  });

  return { projectId: input.projectId };
}

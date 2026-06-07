import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer, isAdminTier } from "@/lib/auth-server";
import { parseDateKey } from "@/lib/daily";
import { getDb } from "@/lib/db";
import { dailyTasks } from "@/lib/db/schema";

// { days: { "2026-05-30": [id1, id2], "2026-05-31": [id3] } }
// Each day's array is the new top-to-bottom order; the date key sets
// planned_date so dragging a card across columns re-plans it.
const reorderSchema = z.object({
  days: z.record(z.string(), z.array(z.string())),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof reorderSchema>;
  try {
    payload = reorderSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const db = getDb();
  const now = new Date();

  const allIds = Object.values(payload.days).flat();
  if (allIds.length === 0) {
    return Response.json({ ok: true });
  }

  const rows = await db
    .select({ id: dailyTasks.id, ownerId: dailyTasks.ownerId })
    .from(dailyTasks)
    .where(inArray(dailyTasks.id, allIds));
  const ownerById = new Map(rows.map((row) => [row.id, row.ownerId]));

  // A viewer may only reorder their own items (admins may reorder anyone's).
  for (const id of allIds) {
    const ownerId = ownerById.get(id);
    if (!ownerId) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }
    if (ownerId !== viewer.id && !isAdminTier(viewer.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  for (const [dateKey, ids] of Object.entries(payload.days)) {
    const plannedDate = parseDateKey(dateKey);
    for (const [index, id] of ids.entries()) {
      await db
        .update(dailyTasks)
        .set({ plannedDate, sortOrder: index, updatedAt: now })
        .where(eq(dailyTasks.id, id));
    }
  }

  revalidatePath("/daily");
  revalidatePath("/admin/daily");

  return Response.json({ ok: true });
}

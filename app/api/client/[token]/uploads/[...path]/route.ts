import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { branches, projects, taskComments, tasks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

type RouteContext = { params: Promise<{ token: string; path: string[] }> };

// PUBLIC, token-scoped image serving for the client board. The /api/uploads
// route is auth-gated (keeps the bucket private), so a logged-out client can't
// load images embedded in a task description there. This route serves an image
// ONLY when:
//   1. the token resolves to a published, non-archived project, AND
//   2. the requested key is actually referenced in one of that project's task
//      descriptions.
// So exposure is scoped to the images this board already shows publicly — a
// client of one board can't fetch arbitrary uploads or another board's assets.
export async function GET(_request: Request, context: RouteContext) {
  const { token, path } = await context.params;
  const key = path.join("/");

  // Only image assets, mirroring the private route's constraint.
  if (!token || !key || !key.startsWith("images/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const db = getDb();
  const [project] = await db
    .select({ id: projects.id, archivedAt: projects.archivedAt })
    .from(projects)
    .where(
      and(
        eq(projects.clientShareToken, token),
        eq(projects.clientShareEnabled, true),
      ),
    )
    .limit(1);

  if (!project || project.archivedAt) {
    return new NextResponse("Not found", { status: 404 });
  }

  // The public board only shows the Main (default) branch, so authorization is
  // scoped to Main's content — a feature-branch task's embedded image must not
  // be served through the public token.
  const [defaultBranch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.projectId, project.id), eq(branches.isDefault, true)))
    .limit(1);
  const defaultBranchId = defaultBranch?.id ?? null;

  // Authorize the specific asset: it must appear in a Main-branch task
  // description or a comment on a Main-branch task (which store the original
  // /api/uploads/<key> ref).
  const [taskRows, commentRows] = await Promise.all([
    db
      .select({ content: tasks.description })
      .from(tasks)
      .where(
        defaultBranchId
          ? and(
              eq(tasks.projectId, project.id),
              eq(tasks.branchId, defaultBranchId),
            )
          : eq(tasks.projectId, project.id),
      ),
    db
      .select({ content: taskComments.content })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .where(
        defaultBranchId
          ? and(
              eq(taskComments.projectId, project.id),
              eq(tasks.branchId, defaultBranchId),
            )
          : eq(taskComments.projectId, project.id),
      ),
  ]);
  const referenced = [...taskRows, ...commentRows].some((row) =>
    row.content?.includes(key),
  );
  if (!referenced) {
    return new NextResponse("Not found", { status: 404 });
  }

  const storage = getStorage();
  if (!storage) {
    return NextResponse.json(
      { error: "Uploads are not configured on this environment." },
      { status: 503 },
    );
  }

  const object = await storage.get(key);
  if (!object) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers();
  if (object.contentType) {
    headers.set("content-type", object.contentType);
  }
  headers.set("cache-control", "public, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-disposition", "inline");
  headers.set("etag", object.etag);

  return new NextResponse(object.body, { headers });
}

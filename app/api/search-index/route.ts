import { getViewer } from "@/lib/auth-server";
import { getSearchIndexForUser } from "@/lib/data";

export async function GET() {
  // Use getViewer (not raw getSession) so a deactivated user holding a valid
  // cookie cannot read their search corpus — consistent with the rest of the app.
  const viewer = await getViewer();

  if (!viewer) {
    return Response.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }

  const items = await getSearchIndexForUser(viewer.id);

  return Response.json(items, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

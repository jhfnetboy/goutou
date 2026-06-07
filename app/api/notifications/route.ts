import { getViewer } from "@/lib/auth-server";
import { getNotificationsForUser } from "@/lib/data";

export async function GET() {
  // Use getViewer (not raw getSession) so a deactivated user holding a valid
  // cookie is rejected here too — consistent with the rest of the app.
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

  const notifications = await getNotificationsForUser(viewer.id);

  return Response.json(
    notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
    })),
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

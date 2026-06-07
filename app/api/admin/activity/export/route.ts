import { requireRole } from "@/lib/auth-server";
import { csvRow as row } from "@/lib/csv";
import {
  listWorkspaceActivity,
  type ActivityFilters,
} from "@/lib/data-admin";
import { getSystemSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

const CSV_LIMIT = 50_000; // hard cap to keep memory bounded

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request: Request) {
  await requireRole(["owner", "admin"]);

  const url = new URL(request.url);
  const filters: ActivityFilters = {
    from: parseDateParam(url.searchParams.get("from")),
    to: parseDateParam(url.searchParams.get("to")),
    projectId: url.searchParams.get("project") ?? undefined,
    actorId: url.searchParams.get("actor") ?? undefined,
  };

  const items = await listWorkspaceActivity(filters, CSV_LIMIT);

  const header = row([
    "Timestamp (ISO)",
    "Actor name",
    "Actor email",
    "Project",
    "Project ID",
    "Entity type",
    "Entity ID",
    "Action",
    "Label",
    "Detail",
  ]);

  const lines = items.map((item) =>
    row([
      item.createdAt.toISOString(),
      item.actorName,
      item.actorEmail,
      item.projectName,
      item.projectId,
      item.entityType,
      item.entityId,
      item.action,
      item.label,
      item.detail,
    ]),
  );

  const body = [header, ...lines].join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  const { systemName } = await getSystemSettings();
  const slug =
    systemName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  const filename = `${slug}-activity-${stamp}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

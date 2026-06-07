import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { getSystemSettings, updateSystemSettings } from "@/lib/system-settings";

// "" clears the asset (→ null); any value must be a branding/ key minted by the
// upload route, so arbitrary keys (e.g. pointing at private images/) can't be set.
const brandingKey = z
  .union([
    z.literal("").transform(() => null),
    z
      .string()
      .trim()
      .max(256)
      .regex(/^branding\/[A-Za-z0-9._\-/]+$/),
  ])
  .nullable()
  .optional();

const updateSchema = z.object({
  webTitle: z.string().trim().min(1).max(80),
  systemName: z.string().trim().min(1).max(60),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Accent must be a #rrggbb hex color."),
  logoDarkKey: brandingKey,
  logoLightKey: brandingKey,
  faviconKey: brandingKey,
  sidebarMarkKey: brandingKey,
});

export async function PATCH(request: Request) {
  await requireRole(["owner", "admin"]);

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const previous = await getSystemSettings();
  const next = {
    webTitle: payload.webTitle,
    systemName: payload.systemName,
    accentColor: payload.accentColor,
    logoDarkKey: payload.logoDarkKey ?? null,
    logoLightKey: payload.logoLightKey ?? null,
    faviconKey: payload.faviconKey ?? null,
    sidebarMarkKey: payload.sidebarMarkKey ?? null,
  };

  await updateSystemSettings(next);

  // Delete branding objects that were replaced/removed so R2 doesn't accumulate
  // orphans. Best-effort — a failed delete must not fail the save.
  try {
    const { env } = getCloudflareContext();
    if (env.UPLOADS) {
      const stale = (
        [
          [previous.logoDarkKey, next.logoDarkKey],
          [previous.logoLightKey, next.logoLightKey],
          [previous.faviconKey, next.faviconKey],
          [previous.sidebarMarkKey, next.sidebarMarkKey],
        ] as const
      )
        .filter(([oldKey, newKey]) => oldKey && oldKey !== newKey)
        .map(([oldKey]) => oldKey as string);
      await Promise.all(stale.map((key) => env.UPLOADS.delete(key)));
    }
  } catch {
    // ignore cleanup failures
  }

  // Branding lives in the root/app layout (title, favicon, accent, logos), so the
  // change affects every route — invalidate the whole tree.
  revalidatePath("/", "layout");

  return Response.json({ ok: true });
}

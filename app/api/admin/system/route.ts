import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { getStorage } from "@/lib/storage";
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
  // Link-preview (Open Graph) card. Blank title/description fall back to the
  // seeder-web defaults; the image is a branding/ key like the logos.
  previewTitle: z.string().trim().max(120).optional(),
  previewDescription: z.string().trim().max(300).optional(),
  previewImageKey: brandingKey,
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
    // Blank title/description → null, so generateMetadata falls back to the
    // seeder-web preview defaults rather than persisting an empty card.
    previewTitle: payload.previewTitle ? payload.previewTitle : null,
    previewDescription: payload.previewDescription
      ? payload.previewDescription
      : null,
    previewImageKey: payload.previewImageKey ?? null,
  };

  await updateSystemSettings(next);

  // Delete branding objects that were replaced/removed so R2 doesn't accumulate
  // orphans. Best-effort — a failed delete must not fail the save.
  try {
    const storage = getStorage();
    if (storage) {
      const stale = (
        [
          [previous.logoDarkKey, next.logoDarkKey],
          [previous.logoLightKey, next.logoLightKey],
          [previous.faviconKey, next.faviconKey],
          [previous.sidebarMarkKey, next.sidebarMarkKey],
          [previous.previewImageKey, next.previewImageKey],
        ] as const
      )
        .filter(([oldKey, newKey]) => oldKey && oldKey !== newKey)
        .map(([oldKey]) => oldKey as string);
      await Promise.all(stale.map((key) => storage.delete(key)));
    }
  } catch {
    // ignore cleanup failures
  }

  // Branding lives in the root/app layout (title, favicon, accent, logos), so the
  // change affects every route — invalidate the whole tree.
  revalidatePath("/", "layout");

  return Response.json({ ok: true });
}

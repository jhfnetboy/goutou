import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/lib/db";
import { systemSettings, type SystemSettings } from "@/lib/db/schema";

// The app's browser-tab/meta description. Not a configurable field in v1, so it
// lives here as a constant rather than a settings column.
export const SYSTEM_DESCRIPTION =
  "A foundational project manager for small teams — projects, client requests, and kanban execution.";

// Default link-preview (Open Graph) card — the seeder-web values (seederpm.xyz).
// Used whenever the admin hasn't overridden a preview field. The image ships in
// public/og so a self-hosted install works offline, no external fetch.
export const PREVIEW_DEFAULTS = {
  title: "Seeder — Your Personal Project Manager",
  description:
    "A foundational, open-source project manager for small teams. Simple to run, self-hostable on Cloudflare or a VM, and yours to fork.",
  image: "/og/seeder-og.png",
};

// Hard fallback used when the row/table is missing OR the D1 read throws. Mirrors
// the migration seed so behaviour is identical pre- and post-seed. updatedAt = 0
// so the cache-busting `?v=` is stable until a real save bumps it.
export const SYSTEM_SETTINGS_DEFAULTS: SystemSettings = {
  id: 1,
  webTitle: "Seeder",
  systemName: "Seeder",
  accentColor: "#10b981",
  logoDarkKey: null,
  logoLightKey: null,
  faviconKey: null,
  sidebarMarkKey: null,
  previewTitle: null,
  previewDescription: null,
  previewImageKey: null,
  updatedAt: new Date(0),
};

/**
 * Request-cached read of the singleton settings row. One D1 query per request,
 * shared by generateMetadata + the root/app layouts + the sign-in page. NEVER
 * throws — the root layout wraps every route (incl. the public board and
 * sign-in), so a settings read must degrade to defaults rather than take the app
 * down.
 */
export const getSystemSettings = cache(async (): Promise<SystemSettings> => {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);
    return row ?? SYSTEM_SETTINGS_DEFAULTS;
  } catch {
    return SYSTEM_SETTINGS_DEFAULTS;
  }
});

/** Upsert the singleton row. Always bumps updatedAt (drives cache-busting). */
export async function updateSystemSettings(
  patch: Partial<Omit<SystemSettings, "id" | "updatedAt">>,
): Promise<void> {
  const db = getDb();
  await db
    .insert(systemSettings)
    .values({ id: 1, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.id,
      set: { ...patch, updatedAt: new Date() },
    });
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate an admin-supplied accent. The value is interpolated into an inline
 * `--brand` CSS custom property on <html>, so a non-hex value must never reach
 * the DOM — fall back to the default emerald.
 */
export function safeAccentColor(value: string | null | undefined): string {
  return value && HEX_COLOR.test(value)
    ? value
    : SYSTEM_SETTINGS_DEFAULTS.accentColor;
}

/** Versioned public URL for a branding asset, or null to use a bundled default. */
export function brandingUrl(
  key: string | null | undefined,
  updatedAt: Date,
): string | null {
  if (!key) return null;
  return `/api/branding/${key}?v=${updatedAt.getTime()}`;
}

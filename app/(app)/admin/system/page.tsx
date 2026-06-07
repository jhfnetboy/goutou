import { SystemSettingsForm } from "@/components/admin/system/system-settings-form";
import { requireRole } from "@/lib/auth-server";
import { brandingUrl, getSystemSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  await requireRole(["owner", "admin"]);
  const settings = await getSystemSettings();

  return (
    <div className="space-y-6">
      <section className="ui-panel p-5 sm:p-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
          Admin · System
        </p>
        <h1 className="mt-2 text-[1.4rem] font-medium tracking-[-0.022em] text-foreground">
          System configuration
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-6 text-muted">
          Branding and appearance for the whole workspace — applied to every
          page, the sign-in screen, and shared client boards.
        </p>
      </section>

      <SystemSettingsForm
        webTitle={settings.webTitle}
        systemName={settings.systemName}
        accentColor={settings.accentColor}
        logoDarkKey={settings.logoDarkKey}
        logoLightKey={settings.logoLightKey}
        faviconKey={settings.faviconKey}
        sidebarMarkKey={settings.sidebarMarkKey}
        logoDarkUrl={brandingUrl(settings.logoDarkKey, settings.updatedAt)}
        logoLightUrl={brandingUrl(settings.logoLightKey, settings.updatedAt)}
        faviconUrl={brandingUrl(settings.faviconKey, settings.updatedAt)}
        sidebarMarkUrl={brandingUrl(settings.sidebarMarkKey, settings.updatedAt)}
      />
    </div>
  );
}

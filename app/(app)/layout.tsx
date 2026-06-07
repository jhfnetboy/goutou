import { Suspense } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { FlashToaster } from "@/components/app/flash-toaster";
import { KeyboardShortcuts } from "@/components/app/keyboard-shortcuts";
import { Toaster } from "@/components/ui/toaster";
import { requireViewer } from "@/lib/auth-server";
import {
  getAppShellDataForViewer,
} from "@/lib/data";
import { brandingUrl, getSystemSettings } from "@/lib/system-settings";

export const dynamic = "force-dynamic";
const APP_SHELL_VERSION = "2026-05-04.3";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await requireViewer();
  const shellData = await getAppShellDataForViewer(viewer);
  const settings = await getSystemSettings();

  return (
    <div
      data-app-shell-version={APP_SHELL_VERSION}
      className="min-h-dvh md:flex md:h-dvh md:overflow-hidden"
    >
      <AppSidebar
        notificationCount={shellData.notificationCount}
        projects={shellData.projects}
        userEmail={viewer.email}
        userName={viewer.name}
        userRole={viewer.role}
        userImage={viewer.image}
        systemName={settings.systemName}
        logoDarkUrl={brandingUrl(settings.logoDarkKey, settings.updatedAt)}
        logoLightUrl={brandingUrl(settings.logoLightKey, settings.updatedAt)}
        sidebarMarkUrl={brandingUrl(settings.sidebarMarkKey, settings.updatedAt)}
      />
      <div className="min-w-0 flex-1 overflow-x-hidden md:min-h-0 md:overflow-y-auto">
        <main className="relative mx-auto flex min-h-dvh w-full min-w-0 max-w-360 flex-col px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 md:min-h-full [&>*]:min-w-0">
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <KeyboardShortcuts />
      </Suspense>
      <Suspense fallback={null}>
        <FlashToaster />
      </Suspense>
      <Toaster />
    </div>
  );
}

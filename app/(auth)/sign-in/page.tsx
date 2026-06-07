import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";

import { SignInPanel } from "@/components/auth/sign-in-panel";
import { getViewer } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { invitations, user } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env";
import { brandingUrl, getSystemSettings } from "@/lib/system-settings";

type SignInPageProps = {
  searchParams: Promise<{
    invite?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Use getViewer (not getSession): a deactivated user can still hold a session
  // but getViewer returns null for them, so they stay on the sign-in form
  // instead of looping into the app (which would bounce them right back).
  const viewer = await getViewer();

  if (viewer) {
    redirect("/projects");
  }

  const { invite } = await searchParams;
  const inviteToken = Array.isArray(invite) ? invite[0] : invite;

  const db = getDb();

  // A fresh instance (zero users) shows the one-time "create owner account"
  // form. The auth create hook (lib/auth.ts) enforces the same zero-user +
  // OWNER_EMAIL gate server-side; this just drives the UI. Once the owner
  // exists, the panel is the normal invite-only sign-in form.
  const [anyUser] = await db.select({ id: user.id }).from(user).limit(1);
  const allowFirstOwner = !anyUser;

  let invitePreview: { token: string; email: string } | null = null;

  if (inviteToken) {
    const [row] = await db
      .select({ token: invitations.token, email: invitations.email })
      .from(invitations)
      .where(
        and(
          eq(invitations.token, inviteToken),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (row) {
      invitePreview = row;
    }
  }

  const settings = await getSystemSettings();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
      <SignInPanel
        hasGoogleAuth={serverEnv.hasGoogleAuth}
        ownerEmail={serverEnv.ownerEmail}
        allowFirstOwner={allowFirstOwner}
        invite={invitePreview}
        systemName={settings.systemName}
        logoDarkUrl={brandingUrl(settings.logoDarkKey, settings.updatedAt)}
        logoLightUrl={brandingUrl(settings.logoLightKey, settings.updatedAt)}
      />
    </main>
  );
}

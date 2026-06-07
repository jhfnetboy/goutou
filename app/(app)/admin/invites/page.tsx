import { desc } from "drizzle-orm";
import { headers } from "next/headers";

import { InviteList } from "@/components/admin/invite-list";
import { InviteForm } from "@/components/admin/invite-form";
import { requireRole } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { invitations } from "@/lib/db/schema";

export default async function AdminInvitesPage() {
  await requireRole(["owner", "admin"]);

  const db = getDb();
  const rows = await db
    .select()
    .from(invitations)
    .orderBy(desc(invitations.createdAt))
    .limit(50);

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  // Server component; evaluated per request. Date.now() is fine here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const items = rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    link: `${baseUrl}/sign-in?invite=${row.token}`,
    status:
      row.acceptedAt !== null
        ? ("accepted" as const)
        : row.expiresAt.getTime() < now
          ? ("expired" as const)
          : ("pending" as const),
  }));

  return (
    <div className="space-y-6">
      <section className="ui-panel ui-header p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
          Admin
        </p>
        <h1 className="mt-2 text-[24px] font-medium tracking-[-0.022em] text-foreground">
          Invitations
        </h1>
        <p className="mt-1 max-w-prose text-[13px] leading-6 text-muted">
          Issue a tokenized link, then forward it to your colleague through any
          channel. They open the link to set a password and join.
        </p>
      </section>

      <InviteForm />
      <InviteList items={items} />
    </div>
  );
}

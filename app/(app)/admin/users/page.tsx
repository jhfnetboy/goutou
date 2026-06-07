import { UsersManager } from "@/components/admin/users-manager";
import { requireRole } from "@/lib/auth-server";
import { listWorkspaceUsers } from "@/lib/data-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const viewer = await requireRole(["owner", "admin"]);
  const users = await listWorkspaceUsers();

  return (
    <UsersManager users={users} viewerId={viewer.id} viewerRole={viewer.role} />
  );
}

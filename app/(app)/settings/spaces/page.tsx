import { isAdminTier, requireViewer } from "@/lib/auth-server";
import {
  listSpaceMembers,
  listSpaces,
  type SpaceMemberRow,
} from "@/lib/services/spaces";
import { SpacesManager } from "@/components/settings/spaces/spaces-manager";

export const dynamic = "force-dynamic";

// Spaces management. Everyone sees their Personal space + the company spaces
// they belong to; workspace admins can create company spaces and manage any;
// a Space Lead manages their own. Member lists are loaded only for the spaces
// the viewer can actually manage.
export default async function SettingsSpacesPage() {
  const viewer = await requireViewer();
  const spaces = await listSpaces(viewer);

  const manageable = spaces.filter(
    (s) => s.kind === "company" && (s.isLead || isAdminTier(viewer.role)),
  );
  const membersBySpace: Record<string, SpaceMemberRow[]> = {};
  await Promise.all(
    manageable.map(async (s) => {
      membersBySpace[s.id] = await listSpaceMembers(viewer, s.id);
    }),
  );

  return (
    <SpacesManager
      spaces={spaces}
      membersBySpace={membersBySpace}
      canCreate={isAdminTier(viewer.role)}
    />
  );
}

import { requireViewer } from "@/lib/auth-server";
import { listSpaces } from "@/lib/services/spaces";
import { PageHeader } from "@/components/app/page-header";
import { SpacesList } from "@/components/spaces/spaces-list";

export const dynamic = "force-dynamic";

// Admin "Teams": every company team, with create. (The /admin layout already
// requires owner/admin.) Each opens to its detail to manage members + see projects.
export default async function AdminTeamsPage() {
  const viewer = await requireViewer();
  const spaces = (await listSpaces(viewer))
    .filter((s) => s.kind === "company")
    .map((s) => ({
      id: s.id,
      name: s.name,
      leadName: s.leadName,
      memberCount: s.memberCount,
      projectCount: s.projectCount,
    }));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Admin · Teams"
        title="Teams"
        description="Create and manage shared company teams. Open one to manage its members and see its projects."
      />
      <section className="ui-panel p-5 sm:p-6">
        <SpacesList spaces={spaces} canCreate />
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";

import { ActivityFeed } from "@/components/projects/activity-feed";
import {
  ProjectBoardSurface,
  ProjectMetricsStrip,
  ProjectNotesSurface,
  ProjectOverviewQuickLinks,
} from "@/components/projects/project-workspace";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import { getProjectWorkspace } from "@/lib/data";

type ProjectOverviewPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectOverviewPage({
  params,
}: ProjectOverviewPageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId, viewer);

  if (!workspace) {
    notFound();
  }

  const currentPath = `/projects/${projectId}`;

  return (
    <ProjectWorkspaceClientShell
      workspace={workspace}
      currentPath={currentPath}
      viewer={{ id: viewer.id, role: viewer.role }}
    >
      <ProjectMetricsStrip workspace={workspace} />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <ProjectBoardSurface workspace={workspace} currentPath={currentPath} />
        <ProjectNotesSurface workspace={workspace} currentPath={currentPath} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <ProjectOverviewQuickLinks projectId={projectId} />
        <ActivityFeed
          title="Recent activity"
          description="Small timeline of the latest changes inside this workspace."
          items={workspace.activity}
        />
      </div>
    </ProjectWorkspaceClientShell>
  );
}

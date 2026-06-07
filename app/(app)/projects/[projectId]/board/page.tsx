import { notFound } from "next/navigation";

import {
  ProjectBoardSurface,
  ProjectMetricsStrip,
} from "@/components/projects/project-workspace";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import { getProjectWorkspace } from "@/lib/data";

type ProjectBoardPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectBoardPage({
  params,
}: ProjectBoardPageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId, viewer);

  if (!workspace) {
    notFound();
  }

  const currentPath = `/projects/${projectId}/board`;

  return (
    <ProjectWorkspaceClientShell
      workspace={workspace}
      currentPath={currentPath}
      viewer={{ id: viewer.id, role: viewer.role }}
    >
      <ProjectMetricsStrip workspace={workspace} />
      <ProjectBoardSurface workspace={workspace} currentPath={currentPath} />
    </ProjectWorkspaceClientShell>
  );
}

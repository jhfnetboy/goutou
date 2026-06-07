import { notFound } from "next/navigation";

import {
  ProjectRequestsSurface,
} from "@/components/projects/project-workspace";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import { getProjectWorkspace } from "@/lib/data";

type ProjectRequestsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectRequestsPage({
  params,
}: ProjectRequestsPageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId, viewer);

  if (!workspace) {
    notFound();
  }

  const currentPath = `/projects/${projectId}/requests`;

  return (
    <ProjectWorkspaceClientShell
      workspace={workspace}
      currentPath={currentPath}
      viewer={{ id: viewer.id, role: viewer.role }}
    >
      <ProjectRequestsSurface workspace={workspace} />
    </ProjectWorkspaceClientShell>
  );
}

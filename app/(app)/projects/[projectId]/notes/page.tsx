import { notFound } from "next/navigation";

import {
  ProjectNotesSurface,
} from "@/components/projects/project-workspace";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import { getProjectWorkspace } from "@/lib/data";

type ProjectNotesPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectNotesPage({
  params,
}: ProjectNotesPageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId, viewer);

  if (!workspace) {
    notFound();
  }

  const currentPath = `/projects/${projectId}/notes`;

  return (
    <ProjectWorkspaceClientShell
      workspace={workspace}
      currentPath={currentPath}
      viewer={{ id: viewer.id, role: viewer.role }}
    >
      <ProjectNotesSurface
        workspace={workspace}
        currentPath={currentPath}
        expanded
      />
    </ProjectWorkspaceClientShell>
  );
}

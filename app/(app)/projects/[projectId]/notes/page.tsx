import { notFound } from "next/navigation";

import {
  ProjectNotesSurface,
} from "@/components/projects/project-workspace";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import { getProjectWorkspace } from "@/lib/data";
import { branchPath } from "@/lib/branch-path";

type ProjectNotesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ branch?: string }>;
};

export default async function ProjectNotesPage({
  params,
  searchParams,
}: ProjectNotesPageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const { branch } = await searchParams;
  const workspace = await getProjectWorkspace(projectId, viewer, branch);

  if (!workspace) {
    notFound();
  }

  const currentPath = branchPath(
    `/projects/${projectId}/notes`,
    workspace.branches,
    workspace.currentBranchId,
  );

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

import { notFound, redirect } from "next/navigation";

import {
  ProjectRequestsSurface,
} from "@/components/projects/project-workspace";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import { getProjectWorkspace, getRequestBranchId } from "@/lib/data";
import { branchPath } from "@/lib/branch-path";
import { withSearchParams } from "@/lib/utils";

type ProjectRequestsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ branch?: string; modal?: string; request?: string }>;
};

export default async function ProjectRequestsPage({
  params,
  searchParams,
}: ProjectRequestsPageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const { branch, modal, request } = await searchParams;
  const workspace = await getProjectWorkspace(projectId, viewer, branch);

  if (!workspace) {
    notFound();
  }

  // A request deep-link (activity feed, history) may target a request on a
  // different branch. If the modal request isn't on the current branch,
  // redirect to the branch that holds it so the modal resolves.
  if (
    request &&
    modal === "request" &&
    !workspace.requests.some((r) => r.id === request)
  ) {
    const requestBranchId = await getRequestBranchId(projectId, request, viewer);
    if (requestBranchId && requestBranchId !== workspace.currentBranchId) {
      const requestBranch = workspace.branches.find(
        (b) => b.id === requestBranchId,
      );
      redirect(
        withSearchParams(`/projects/${projectId}/requests`, {
          branch: requestBranch?.isDefault ? null : requestBranchId,
          modal,
          request,
        }),
      );
    }
  }

  const currentPath = branchPath(
    `/projects/${projectId}/requests`,
    workspace.branches,
    workspace.currentBranchId,
  );

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

import { withSearchParams } from "@/lib/utils";

/**
 * Build a workspace path that carries the current branch as `?branch` — but
 * ONLY when it isn't the default "Main" branch, so Main URLs stay clean. The
 * selected branch then rides along through every modal/deep-link href built
 * from this path (withSearchParams merges into the existing query). Pass the
 * branch list + resolved id from getProjectWorkspace.
 */
export function branchPath(
  basePath: string,
  branches: Array<{ id: string; isDefault: boolean }>,
  currentBranchId: string | null,
): string {
  if (!currentBranchId) return basePath;
  const current = branches.find((branch) => branch.id === currentBranchId);
  if (!current || current.isDefault) return basePath;
  return withSearchParams(basePath, { branch: currentBranchId });
}

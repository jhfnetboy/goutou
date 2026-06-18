"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GitBranch } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type BranchOption = { id: string; name: string; isDefault: boolean };

type BranchIndicatorProps = {
  projectId: string;
  branches: BranchOption[];
};

/**
 * Header control showing the project's CURRENT branch and linking to the
 * Branches list page (where you switch by picking one). The current branch is
 * read from the `?branch` query param — a client concern, since a Server
 * Component layout never receives searchParams — and falls back to the default
 * "Main" branch when none is selected.
 */
export function BranchIndicator({ projectId, branches }: BranchIndicatorProps) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("branch");
  const current =
    branches.find((branch) => branch.id === requested) ??
    branches.find((branch) => branch.isDefault) ??
    branches[0];

  const branchesHref = `/projects/${projectId}/branches`;
  const label = current?.name ?? "Branches";

  return (
    <Link
      href={branchesHref}
      title="View and switch branches"
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] font-medium text-foreground transition",
        "hover:border-border-strong hover:bg-surface-strong",
      )}
    >
      <GitBranch className="size-4 text-muted" />
      <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
        Branch
      </span>
      <span className="max-w-40 truncate">{label}</span>
      {current?.isDefault ? <span className="ui-badge">default</span> : null}
      {branches.length > 1 ? (
        <span className="font-mono text-[11px] text-muted">
          · {branches.length}
        </span>
      ) : null}
    </Link>
  );
}

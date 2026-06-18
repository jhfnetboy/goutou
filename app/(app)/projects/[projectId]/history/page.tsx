import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut, Pulse } from "@phosphor-icons/react/dist/ssr";

import { ActivityActionBadge } from "@/components/projects/activity-action-badge";
import { ActivityChangesButton } from "@/components/projects/activity-changes-modal";
import { ProjectHistoryFilters } from "@/components/projects/project-history-filters";
import { ProjectWorkspaceClientShell } from "@/components/projects/project-workspace-ui";
import { requireViewer } from "@/lib/auth-server";
import {
  getProjectWorkspace,
  listProjectActivity,
  listProjectActivityActors,
  type ProjectActivityFilters,
} from "@/lib/data";
import { branchPath } from "@/lib/branch-path";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 200;

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString();
}

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function pickFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    q?: string | string[];
    from?: string | string[];
    to?: string | string[];
    actor?: string | string[];
    action?: string | string[];
    field?: string | string[];
    branch?: string | string[];
  }>;
};

export default async function ProjectHistoryPage({
  params,
  searchParams,
}: PageProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const raw = await searchParams;

  // Activity is project-wide (spans all branches by design); the branch param is
  // honored only to keep the header switcher + tab links on the same branch.
  const workspace = await getProjectWorkspace(
    projectId,
    viewer,
    pickFirst(raw.branch),
  );
  if (!workspace) {
    notFound();
  }

  const filters: ProjectActivityFilters = {
    q: pickFirst(raw.q) || undefined,
    from: parseDateParam(pickFirst(raw.from)),
    to: parseDateParam(pickFirst(raw.to)),
    actorId: pickFirst(raw.actor) || undefined,
    action: pickFirst(raw.action) || undefined,
    field: pickFirst(raw.field) || undefined,
  };

  const [items, actors] = await Promise.all([
    listProjectActivity(projectId, viewer, filters, HISTORY_LIMIT),
    listProjectActivityActors(projectId, viewer),
  ]);

  const currentPath = branchPath(
    `/projects/${projectId}/history`,
    workspace.branches,
    workspace.currentBranchId,
  );
  const qString = pickFirst(raw.q) ?? "";
  const fromString = pickFirst(raw.from) ?? "";
  const toString = pickFirst(raw.to) ?? "";
  const actorString = pickFirst(raw.actor) ?? "";
  const actionString = pickFirst(raw.action) ?? "";
  const fieldString = pickFirst(raw.field) ?? "";

  return (
    <ProjectWorkspaceClientShell
      workspace={workspace}
      currentPath={currentPath}
      viewer={{ id: viewer.id, role: viewer.role }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <ProjectHistoryFilters
          basePath={currentPath}
          actors={actors}
          initial={{
            q: qString,
            from: fromString,
            to: toString,
            actorId: actorString,
            action: actionString,
            field: fieldString,
          }}
        />

        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
          Showing up to {HISTORY_LIMIT} matching events · {items.length} found
        </p>

        <div className="ui-panel divide-y divide-border">
          {items.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center text-[13px] leading-7 text-muted">
              <Pulse className="size-5 text-muted" />
              <p className="mt-3">No activity matches these filters.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start gap-3 px-4 py-3"
              >
                <span className="flex w-20 shrink-0">
                  <ActivityActionBadge action={item.action} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground">
                    <span className="font-medium">{item.actorName}</span>{" "}
                    <span className="text-muted">{item.label.toLowerCase()}</span>
                    {item.detail ? (
                      <span className="text-muted"> — {item.detail}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                    <span className="uppercase tracking-[0.04em]">
                      {item.entityType}
                    </span>
                    <span>·</span>
                    <span>{formatRelative(item.createdAt)}</span>
                  </p>
                  {item.changes && item.changes.length ? (
                    <div className="mt-2">
                      <ActivityChangesButton
                        title={`${item.actorName} ${item.label.toLowerCase()}`}
                        subtitle={item.detail}
                        changes={item.changes}
                      />
                    </div>
                  ) : null}
                </div>
                <Link
                  href={item.href}
                  className="inline-flex size-7 items-center justify-center rounded-sm text-muted transition hover:bg-surface hover:text-foreground"
                  aria-label="Open referenced entity"
                >
                  <ArrowSquareOut className="size-4" />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </ProjectWorkspaceClientShell>
  );
}

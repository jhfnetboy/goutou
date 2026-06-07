import Link from "next/link";
import {
  ArrowSquareOut,
  Archive,
  ChatCircleText,
  Folders,
} from "@phosphor-icons/react/dist/ssr";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { requireViewer } from "@/lib/auth-server";
import { getProjectsDashboardForViewer } from "@/lib/data";
import { formatProjectStatus } from "@/lib/project-status";
import { cn, withSearchParams } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PROJECTS_PAGE_VERSION = "2026-05-11.1";

type ProjectsPageSearchParams = {
  modal?: string | string[];
  view?: string | string[];
};

const projectStatusBadgeClassNames = {
  production: "border-emerald/30 bg-emerald/10 text-emerald",
  development: "border-aether-blue/40 bg-transparent text-aether-blue",
  poc: "border-border bg-surface text-muted",
  on_hold: "border-border bg-surface text-muted-strong",
  completed: "border-border bg-surface text-foreground",
} as const;

function toSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildViewHref(path: string, view: "open" | "archived") {
  return withSearchParams(path, {
    view: view === "archived" ? "archived" : undefined,
  });
}

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Open-ended";
  }

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SectionFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "ui-panel p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-6 text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <SectionFrame className="p-4 sm:p-4">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-[28px] font-medium tracking-[-0.022em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[13px] leading-6 text-muted">{detail}</p>
    </SectionFrame>
  );
}

type ProjectsPageProps = {
  searchParams: Promise<ProjectsPageSearchParams>;
};

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const viewer = await requireViewer();
  const resolvedSearchParams = await searchParams;
  const modal = toSingleParam(resolvedSearchParams.modal);
  const view = toSingleParam(resolvedSearchParams.view) === "archived"
    ? "archived"
    : "open";
  const dashboard = await getProjectsDashboardForViewer(viewer, view);
  const currentPath = "/projects";
  const viewPath = buildViewHref(currentPath, view);
  const summary = view === "archived" ? dashboard.archivedSummary : dashboard.summary;
  const projectsNeedingAttention = dashboard.projects.filter(
    (project) =>
      project.isOverdue ||
      project.requestCounts.inbox > 0 ||
      project.taskCounts.doing > 0,
  ).length;

  return (
    <>
      <div
        data-projects-page-version={PROJECTS_PAGE_VERSION}
        className="grid gap-6"
      >
        <SectionFrame className="ui-header">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">Projects</p>
              <h1 className="text-3xl font-medium tracking-tighter text-foreground sm:text-[40px]">
                {view === "archived" ? "Archived workspaces" : "Project index"}
              </h1>
              <p className="max-w-2xl text-[13px] leading-6 text-muted sm:text-[15px]">
                {view === "archived"
                  ? "Keep archived work out of the main list, but close enough to restore when needed."
                  : "Open active work fast, keep archived work separate, and avoid turning this page into a metrics wall."}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                <span>{dashboard.summary.totalProjects} open</span>
                <span>{dashboard.archivedProjects.length} archived</span>
                <span>{projectsNeedingAttention} need attention</span>
                <span>{viewer.email}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={buildViewHref(currentPath, "open")}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-[13px] font-medium transition",
                    view === "open"
                      ? "border-border-strong bg-surface-strong text-foreground"
                      : "border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-strong hover:text-foreground",
                  )}
                >
                  Open
                </Link>
                <Link
                  href={buildViewHref(currentPath, "archived")}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md border px-3 py-1.5 text-[13px] font-medium transition",
                    view === "archived"
                      ? "border-border-strong bg-surface-strong text-foreground"
                      : "border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-strong hover:text-foreground",
                  )}
                >
                  Archived
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <CreateProjectModal
                closeHref={viewPath}
                clearUrlOnClose={modal === "new-project"}
                defaultOpen={modal === "new-project"}
              />
            </div>
          </div>
        </SectionFrame>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Todo"
            value={summary.tasksTodo.toString()}
            detail={
              view === "archived"
                ? "Tasks left untouched in archived work."
                : "Tasks waiting to start."
            }
          />
          <StatCard
            label="Doing"
            value={summary.tasksInProgress.toString()}
            detail={
              view === "archived"
                ? "Tasks still marked as in progress."
                : "Tasks actively being worked."
            }
          />
          <StatCard
            label="Finished"
            value={summary.completedTasks.toString()}
            detail={
              view === "archived"
                ? "Tasks completed inside archived workspaces."
                : "Tasks completed across all open projects."
            }
          />
        </div>

        <SectionFrame>
          <SectionHeader
            title={view === "archived" ? "Archived workspaces" : "Your workspaces"}
            description={
              view === "archived"
                ? "Restore a workspace when it needs to return to the main list."
                : "Open a project when you want to work. Keep the rest visible, but quiet."
            }
            action={
              <span className="ui-badge">
                {dashboard.projects.length} total
              </span>
            }
          />

          {dashboard.projects.length ? (
            <div className="grid gap-2">
              {dashboard.projects.map((project) => {
                const colorStyle = project.color
                  ? {
                      borderLeftWidth: 3,
                      borderLeftColor: project.color,
                      backgroundColor: `color-mix(in srgb, ${project.color} 8%, transparent)`,
                    }
                  : undefined;
                return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={cn(
                    "group rounded-md border border-border px-4 py-3 transition hover:border-border-strong",
                    project.color ? null : "bg-surface hover:bg-surface-strong",
                  )}
                  style={colorStyle}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em]",
                            projectStatusBadgeClassNames[project.status],
                          )}
                        >
                          {formatProjectStatus(project.status)}
                        </span>
                        {project.archivedAt ? (
                          <span className="ui-badge">archived</span>
                        ) : null}
                        {project.isOverdue ? (
                          <span className="inline-flex rounded-sm border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-danger">
                            overdue
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-medium tracking-[-0.011em] text-foreground">
                          {project.name}
                        </h3>
                        {project.clientName && project.clientName !== project.name ? (
                          <p className="mt-0.5 text-[13px] leading-6 text-muted">
                            {project.clientName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 lg:max-w-105 lg:flex-1">
                      <div className="rounded-sm border border-border bg-background px-3 py-2">
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                          Inbox
                        </p>
                        <p className="mt-1 font-mono text-base font-medium text-foreground">
                          {project.requestCounts.inbox}
                        </p>
                      </div>

                      <div className="rounded-sm border border-border bg-background px-3 py-2">
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                          Doing
                        </p>
                        <p className="mt-1 font-mono text-base font-medium text-foreground">
                          {project.taskCounts.doing}
                        </p>
                      </div>

                      <div className="rounded-sm border border-border bg-background px-3 py-2">
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                          Deadline
                        </p>
                        <p className="mt-1 text-[13px] font-medium text-foreground">
                          {project.isOverdue ? "Overdue" : formatDateLabel(project.deadline)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-[13px] text-muted">
                    <p className="min-w-0 flex-1 truncate leading-6">
                      {project.summary ||
                        "No project summary yet. Add the scope and current focus once the workspace is defined."}
                    </p>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <ChatCircleText className="size-4" />
                      {project.openTasks} open
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-foreground">
                      Open
                      <ArrowSquareOut className="size-4 text-muted transition group-hover:text-foreground" />
                    </span>
                  </div>
                </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-surface px-5 py-12 text-center">
              <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-muted">
                {view === "archived" ? <Archive className="size-5" /> : <Folders className="size-5" />}
              </div>
              <p className="mt-3 text-[13px] font-medium text-foreground">
                {view === "archived" ? "No archived projects" : "Start a workspace"}
              </p>
              <p className="mt-1 mx-auto max-w-sm text-[13px] leading-6 text-muted">
                {view === "archived"
                  ? "Archive a workspace from project settings when it should leave the main list."
                  : "Create one to track requests, board work, and notes side by side."}
              </p>
            </div>
          )}
        </SectionFrame>
      </div>
    </>
  );
}

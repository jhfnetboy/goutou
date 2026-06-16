import type { CSSProperties } from "react";
import Link from "next/link";
import { CalendarDots, StackSimple } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";

import { CopyPublicLink } from "@/components/projects/copy-public-link";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { requireViewer } from "@/lib/auth-server";
import { getProjectForUser } from "@/lib/data";
import { serverEnv } from "@/lib/env";
import { formatProjectStatus } from "@/lib/project-status";
import { cn, formatDate } from "@/lib/utils";

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const viewer = await requireViewer();
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, viewer);

  if (!project) {
    notFound();
  }

  const hasColor = Boolean(project.color);
  const headerStyle: CSSProperties | undefined = hasColor
    ? ({ "--ui-header-bg": project.color } as CSSProperties)
    : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section
        className={cn("ui-panel p-5 sm:p-6", hasColor && "ui-header")}
        style={headerStyle}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-foreground">
                  <StackSimple className="size-4" />
                  Project workspace
                </div>
                {project.archivedAt ? (
                  <div className="ui-badge">Archived</div>
                ) : null}
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                  <Link href="/projects" className="hover:text-foreground">
                    Projects
                  </Link>
                  {" / "}
                  <span className="text-foreground">
                    {project.slug ?? project.name}
                  </span>
                </p>
                <h1 className="mt-2 text-3xl font-medium tracking-tighter text-foreground sm:text-[40px]">
                  {project.name}
                </h1>
                <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted sm:text-[15px]">
                  {project.summary ||
                    "A focused operating space for requests, execution, and project memory."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-md border border-border bg-surface px-4 py-3 sm:min-w-65">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                  Status
                </p>
                <p className="mt-1 text-[15px] font-medium text-foreground">
                  {formatProjectStatus(project.status)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                  Client
                </p>
                <p className="mt-1 text-[13px] text-foreground">
                  {project.clientName || "No client assigned"}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                <CalendarDots className="size-3.5" />
                {formatDate(project.deadline, "No deadline set")}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ProjectTabs projectId={project.id} />
            <CopyPublicLink
              enabled={project.clientShareEnabled}
              token={project.clientShareToken}
              baseUrl={serverEnv.betterAuthUrl}
              projectId={project.id}
              settingsHref={`/projects/${project.id}/settings`}
            />
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}

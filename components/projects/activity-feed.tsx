import Link from "next/link";
import { ArrowSquareOut, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";

import { ActivityActionBadge } from "@/components/projects/activity-action-badge";
import { ActivityChangesButton } from "@/components/projects/activity-changes-modal";
import { ProjectColorBadge } from "@/components/projects/project-color-badge";
import type { RecentActivityItem } from "@/lib/data";
import { cn } from "@/lib/utils";

function formatActivityTime(value: Date) {
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityFeed({
  title,
  description,
  items,
  showProjectName = false,
  className,
}: {
  title: string;
  description: string;
  items: RecentActivityItem[];
  showProjectName?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "ui-panel p-5 sm:p-6",
        className,
      )}
    >
      <div className="mb-6 flex items-start gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-muted-strong">
          <ClockCounterClockwise className="size-5" />
        </div>
        <div>
          <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-6 text-muted">
            {description}
          </p>
        </div>
      </div>

      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => {
            // Cross-project feed (Today / dashboard): tint each card with a
            // left-edge accent + soft wash of the project's color, matching the
            // project list. Single-project feeds stay neutral.
            const tint = showProjectName ? item.projectColor : null;
            const cardStyle = tint
              ? {
                  borderLeftWidth: 3,
                  borderLeftColor: tint,
                  backgroundColor: `color-mix(in srgb, ${tint} 8%, var(--surface))`,
                }
              : undefined;
            return (
            <div
              key={item.id}
              className={cn(
                "relative flex items-start justify-between gap-4 rounded-md border border-border px-4 py-3 transition hover:border-border-strong",
                tint ? null : "bg-surface hover:bg-surface-strong",
              )}
              style={cardStyle}
            >
              {/* Stretched link makes the whole card navigable; the Show-details
                  button sits above it (relative z-10) so it opens the modal
                  instead of navigating. */}
              <Link
                href={item.href}
                aria-label={item.label}
                className="absolute inset-0 rounded-md"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ActivityActionBadge action={item.action} />
                  <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                  {showProjectName ? (
                    <ProjectColorBadge
                      name={item.projectName}
                      color={item.projectColor}
                    />
                  ) : null}
                </div>
                {item.detail ? (
                  <p className="mt-1 text-[13px] leading-6 text-muted">
                    {item.detail}
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                  by <span className="text-foreground">{item.actorName}</span>
                </p>
                {item.changes && item.changes.length ? (
                  <div className="relative z-10 mt-2">
                    <ActivityChangesButton
                      title={`${item.actorName} ${item.label.toLowerCase()}`}
                      subtitle={item.detail}
                      changes={item.changes}
                    />
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-[11px] text-muted">{formatActivityTime(item.createdAt)}</p>
                <ArrowSquareOut className="ml-auto mt-2 size-4 text-muted" />
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-[13px] leading-7 text-muted">
          No recent changes yet.
        </div>
      )}
    </section>
  );
}

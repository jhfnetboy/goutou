"use client";

import { useMemo, useState } from "react";
import { GitCommit } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 5;
const LOAD_MORE_INCREMENT = 5;

export type ClientStatusUpdate = {
  id: string;
  taskTitle: string;
  summary: string;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
};

export function ClientStatusUpdates({
  updates,
}: {
  updates: ClientStatusUpdate[];
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const visible = updates.slice(0, visibleCount);
  const remaining = updates.length - visible.length;

  const groups = useMemo(() => {
    return visible.reduce<
      Array<{ key: string; label: string; items: ClientStatusUpdate[] }>
    >((acc, update) => {
      const existing = acc.find((group) => group.key === update.dayKey);
      if (existing) {
        existing.items.push(update);
        return acc;
      }
      acc.push({ key: update.dayKey, label: update.dayLabel, items: [update] });
      return acc;
    }, []);
  }, [visible]);

  if (updates.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-center text-[13px] leading-7 text-muted">
        No public status updates yet. Completed tasks can be published from the
        internal task modal.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {groups.map((group, groupIndex) => (
          <div
            key={group.key}
            className={cn(
              "grid gap-4 px-4 py-4 sm:grid-cols-[148px_1fr] sm:px-5",
              groupIndex > 0 && "border-t border-border",
            )}
          >
            <div className="pt-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                {group.label}
              </p>
            </div>
            <div className="space-y-2">
              {group.items.map((update) => (
                <div
                  key={update.id}
                  className="rounded-md border border-border bg-background px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex size-7 items-center justify-center rounded-sm border border-border bg-surface text-accent">
                          <GitCommit className="size-4" />
                        </span>
                        <p className="text-[13px] font-medium text-foreground">
                          {update.taskTitle}
                        </p>
                      </div>
                      <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 text-muted">
                        {update.summary}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                        {update.timeLabel}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted">Done</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {remaining > 0 ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) => current + LOAD_MORE_INCREMENT)
            }
            className="ui-button-secondary"
          >
            Load {Math.min(remaining, LOAD_MORE_INCREMENT)} more
            <span className="ml-2 font-mono text-[11px] text-muted">
              {remaining} remaining
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

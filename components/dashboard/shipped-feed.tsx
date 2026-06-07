import Link from "next/link";
import { Megaphone } from "@phosphor-icons/react/dist/ssr";

import type { DashboardData } from "@/lib/data";

function getStartOfWeek(value: Date) {
  const day = value.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + offsetToMonday);
}

function formatWeekLabel(weekStart: Date, today: Date) {
  const thisWeek = getStartOfWeek(today);
  const lastWeek = new Date(thisWeek.getTime() - 7 * 86_400_000);
  if (weekStart.getTime() === thisWeek.getTime()) return "This week";
  if (weekStart.getTime() === lastWeek.getTime()) return "Last week";
  return `Week of ${weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: weekStart.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  })}`;
}

function formatRelative(createdAt: Date, now: Date) {
  const diff = now.getTime() - createdAt.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ShippedFeed({ data }: { data: DashboardData["shippedFeed"] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-center">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-muted">
          <Megaphone className="size-5" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-foreground">Nothing shipped yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-6 text-muted">
          Publish one from a finished task to start your shipping log.
        </p>
      </div>
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const grouped = new Map<number, typeof data>();
  for (const entry of data) {
    const weekKey = getStartOfWeek(entry.createdAt).getTime();
    const bucket = grouped.get(weekKey);
    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(weekKey, [entry]);
    }
  }
  const sortedWeeks = [...grouped.entries()].sort(
    ([leftKey], [rightKey]) => rightKey - leftKey,
  );

  return (
    <div className="grid gap-6">
      {sortedWeeks.map(([weekKey, entries]) => (
        <div key={weekKey} className="grid gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            {formatWeekLabel(new Date(weekKey), today)}
          </p>
          <div className="grid gap-2">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                className="group rounded-md border border-border bg-surface px-4 py-3 transition hover:border-border-strong hover:bg-surface-strong"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-badge">{entry.projectName}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                    {entry.taskTitle}
                  </span>
                  <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                    {formatRelative(entry.createdAt, now)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-muted">
                  {entry.summary}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

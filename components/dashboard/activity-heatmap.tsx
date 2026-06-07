"use client";

import { Calendar } from "@phosphor-icons/react";
import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import { ActivityCalendar } from "react-activity-calendar";

import type { DashboardData } from "@/lib/data";

type HeatmapDay = DashboardData["heatmap"][number];

function formatTooltipDate(dateKey: string) {
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return dateKey;
  }
  return new Date(year, month, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const LABEL_GUTTER_PX = 36;
const WEEKS_IN_YEAR = 53;
const BLOCK_SIZE_MIN = 11;
const BLOCK_SIZE_MAX = 40;
const BLOCK_MARGIN = 4;

function readAccentStops(): string[] {
  if (typeof window === "undefined") {
    return ["#1f2125", "#27a64430", "#27a64460", "#27a64490", "#27a644"];
  }
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent").trim() || "#a7e34a";
  const surfaceStrong = styles.getPropertyValue("--surface-strong").trim() || "#1f2125";
  return [
    surfaceStrong,
    `color-mix(in oklab, ${accent} 25%, ${surfaceStrong})`,
    `color-mix(in oklab, ${accent} 50%, ${surfaceStrong})`,
    `color-mix(in oklab, ${accent} 75%, ${surfaceStrong})`,
    accent,
  ];
}

export function ActivityHeatmap({ data }: { data: DashboardData["heatmap"] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stops, setStops] = useState<string[] | null>(null);
  const [blockSize, setBlockSize] = useState(14);

  useEffect(() => {
    const update = () => setStops(readAccentStops());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const usable = el.clientWidth - LABEL_GUTTER_PX;
      const next = Math.floor(usable / WEEKS_IN_YEAR - BLOCK_MARGIN);
      setBlockSize(Math.max(BLOCK_SIZE_MIN, Math.min(BLOCK_SIZE_MAX, next)));
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const breakdownByDate = useMemo(() => {
    const map = new Map<string, { shipped: number; subtasks: number; total: number }>();
    for (const day of data) {
      map.set(day.date, { shipped: day.shipped, subtasks: day.subtasks, total: day.count });
    }
    return map;
  }, [data]);

  const total = data.reduce((sum, day) => sum + day.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-center">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-muted">
          <Calendar className="size-5" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-foreground">No activity yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-6 text-muted">
          No project events in the last year.
        </p>
      </div>
    );
  }

  if (!stops) {
    return <div ref={containerRef} className="h-40 animate-pulse rounded-sm bg-surface-strong" />;
  }

  return (
    <div ref={containerRef} className="w-full min-w-0 overflow-x-auto pb-1">
      <ActivityCalendar
        data={data}
        blockSize={blockSize}
        blockMargin={BLOCK_MARGIN}
        blockRadius={Math.max(2, Math.floor(blockSize / 5))}
        fontSize={12}
        showWeekdayLabels
        theme={{ light: stops, dark: stops }}
        labels={{
          totalCount: "{{count}} activities in the last year",
          legend: { less: "Less", more: "More" },
        }}
        style={{ color: "var(--muted)" }}
        renderBlock={(block, activity) => {
          const day = activity as HeatmapDay;
          const breakdown =
            breakdownByDate.get(day.date) ?? { shipped: 0, subtasks: 0, total: day.count };
          const tooltip = `${formatTooltipDate(day.date)} — ${breakdown.shipped} shipped · ${breakdown.subtasks} subtasks · ${breakdown.total} total`;
          return cloneElement(block, { title: tooltip });
        }}
      />
    </div>
  );
}

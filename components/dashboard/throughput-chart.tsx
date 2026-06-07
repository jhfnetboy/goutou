"use client";

import { TrendUp } from "@phosphor-icons/react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardData } from "@/lib/data";

const GRADIENT_ID = "throughput-area-gradient";

export function ThroughputChart({ data }: { data: DashboardData["throughput"] }) {
  const shippedTotal = data.reduce((sum, day) => sum + day.shippedCount, 0);
  const subtasksTotal = data.reduce((sum, day) => sum + day.subtasksCompleted, 0);

  if (shippedTotal === 0 && subtasksTotal === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-center">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-muted">
          <TrendUp className="size-5" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-foreground">No throughput yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-6 text-muted">
          No client updates published or subtasks completed in the last 84 days. Publish an update or tick a subtask to start your log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ backgroundColor: "var(--accent)" }} />
          Shipped
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-px w-3"
            style={{
              borderTop: "1.5px dashed var(--muted)",
            }}
          />
          Subtasks
        </span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dayLabel"
              stroke="var(--muted)"
              tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              interval={6}
              padding={{ left: 4, right: 4 }}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                padding: "8px 10px",
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 500 }}
              itemStyle={{ color: "var(--foreground)" }}
              formatter={(value: number, name) => {
                const noun = name === "Shipped" ? "shipped" : "subtasks";
                return [`${value} ${noun}`, ""];
              }}
            />
            <Area
              type="monotone"
              dataKey="shippedCount"
              name="Shipped"
              stroke="var(--accent)"
              strokeWidth={2}
              fill={`url(#${GRADIENT_ID})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--accent)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
            <Line
              type="monotone"
              dataKey="subtasksCompleted"
              name="Subtasks"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{
                r: 3,
                fill: "var(--muted)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

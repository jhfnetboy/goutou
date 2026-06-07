"use client";

import { ListBullets } from "@phosphor-icons/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardData } from "@/lib/data";

export function VelocityBars({ data }: { data: DashboardData["velocityByProject"] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-5 py-10 text-center">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-muted">
          <ListBullets className="size-5" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-foreground">No velocity yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-6 text-muted">
          No projects shipped updates in the last 30 days. Publish one from a finished task.
        </p>
      </div>
    );
  }

  const chartHeight = Math.max(180, data.length * 32 + 24);

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted)"
            tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="projectName"
            stroke="var(--muted)"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-strong)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              padding: "8px 10px",
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 500 }}
            itemStyle={{ color: "var(--foreground)" }}
            formatter={(value: number) => [`${value} shipped`, ""]}
          />
          <Bar dataKey="shippedCount" fill="var(--accent)" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

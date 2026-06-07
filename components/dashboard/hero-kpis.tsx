import type { DashboardData } from "@/lib/data";

function KpiCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section className="ui-panel p-4">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-[28px] font-medium tracking-[-0.022em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[13px] leading-6 text-muted">{detail}</p>
    </section>
  );
}

export function HeroKpis({ totals }: { totals: DashboardData["totals"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Shipped 7d"
        value={totals.shipped7d.toString()}
        detail="Updates published this week."
      />
      <KpiCard
        label="Shipped 30d"
        value={totals.shipped30d.toString()}
        detail="Updates in the last 30 days."
      />
      <KpiCard
        label="All-time shipped"
        value={totals.shippedAllTime.toString()}
        detail="Lifetime client updates."
      />
      <KpiCard
        label="Active days (30d)"
        value={totals.activeDays30d.toString()}
        detail="Days with at least one activity."
      />
    </div>
  );
}

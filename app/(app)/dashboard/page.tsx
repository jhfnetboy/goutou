import { requireSession } from "@/lib/auth-server";
import { getDashboardForUser } from "@/lib/data";

import { HeroKpis } from "@/components/dashboard/hero-kpis";
import { ThroughputChart } from "@/components/dashboard/throughput-chart";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { VelocityBars } from "@/components/dashboard/velocity-bars";
import { PressureTable } from "@/components/dashboard/pressure-table";
import { ShippedFeed } from "@/components/dashboard/shipped-feed";

export const dynamic = "force-dynamic";
const DASHBOARD_PAGE_VERSION = "2026-05-11.1";

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await getDashboardForUser(session.user.id);

  return (
    <div
      data-dashboard-page-version={DASHBOARD_PAGE_VERSION}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6"
    >
      <section className="ui-panel ui-header p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">Dashboard</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tighter text-foreground sm:text-[40px]">
          Performance
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted sm:text-[15px]">
          What you shipped, when you shipped it, and where pressure is building up.
        </p>
      </section>

      <HeroKpis totals={data.totals} />

      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Throughput
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            Client updates published and subtasks completed per day, last 84 days.
          </p>
        </header>
        <ThroughputChart data={data.throughput} />
      </section>

      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Activity
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            Every project event in the last year.
          </p>
        </header>
        <ActivityHeatmap data={data.heatmap} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-panel p-5 sm:p-6">
          <header className="mb-4">
            <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
              Velocity by project
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted">
              Updates published per project, last 30 days.
            </p>
          </header>
          <VelocityBars data={data.velocityByProject} />
        </section>

        <section className="ui-panel p-5 sm:p-6">
          <header className="mb-4">
            <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
              Pressure leaderboard
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted">
              Open projects sorted by accumulated pressure.
            </p>
          </header>
          <PressureTable data={data.pressureLeaderboard} />
        </section>
      </div>

      <section className="ui-panel p-5 sm:p-6">
        <header className="mb-4">
          <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Shipped feed
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            Every client update you published recently.
          </p>
        </header>
        <ShippedFeed data={data.shippedFeed} />
      </section>
    </div>
  );
}

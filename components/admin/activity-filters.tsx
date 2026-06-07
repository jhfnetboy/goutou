"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowCounterClockwise,
  DownloadSimple,
  Funnel,
} from "@phosphor-icons/react";

import { SearchSelect } from "@/components/ui/search-select";

type Props = {
  projects: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  initial: {
    from: string;
    to: string;
    projectId: string;
    actorId: string;
  };
};

function buildSearch(state: Props["initial"]) {
  const params = new URLSearchParams();
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.projectId) params.set("project", state.projectId);
  if (state.actorId) params.set("actor", state.actorId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function ActivityFilters({ projects, users, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const apply = () => {
    startTransition(() => {
      router.push(`/admin/activity${buildSearch(state)}`);
    });
  };

  const clear = () => {
    setState({ from: "", to: "", projectId: "", actorId: "" });
    startTransition(() => {
      router.push("/admin/activity");
    });
  };

  const exportCsv = () => {
    window.location.href = `/api/admin/activity/export${buildSearch(state)}`;
  };

  const update = <K extends keyof Props["initial"]>(
    key: K,
    value: Props["initial"][K],
  ) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="ui-panel-soft p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            From
          </span>
          <input
            type="date"
            value={state.from}
            onChange={(e) => update("from", e.target.value)}
            className="ui-input"
            max={state.to || undefined}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            To
          </span>
          <input
            type="date"
            value={state.to}
            onChange={(e) => update("to", e.target.value)}
            className="ui-input"
            min={state.from || undefined}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            Project
          </span>
          <SearchSelect
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            value={state.projectId || undefined}
            onChange={(v) => update("projectId", v ?? "")}
            placeholder="All projects"
            searchPlaceholder="Search projects…"
            clearLabel="All projects"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            User
          </span>
          <SearchSelect
            options={users.map((u) => ({
              value: u.id,
              label: u.name,
              sublabel: u.email,
            }))}
            value={state.actorId || undefined}
            onChange={(v) => update("actorId", v ?? "")}
            placeholder="All users"
            searchPlaceholder="Search users…"
            clearLabel="All users"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={isPending}
          className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Funnel className="size-4" />
          Apply
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={isPending}
          className="ui-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowCounterClockwise className="size-4" />
          Clear
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={exportCsv}
          className="ui-button-secondary"
          title="Download CSV of the current filter"
        >
          <DownloadSimple className="size-4" />
          Export CSV
        </button>
      </div>
    </div>
  );
}

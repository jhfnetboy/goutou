"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { activityActionValues } from "@/lib/db/schema";
import type { ProjectActivityActor } from "@/lib/data";

const ACTION_OPTIONS: SearchSelectOption[] = activityActionValues.map(
  (action) => ({
    value: action,
    label: action.charAt(0).toUpperCase() + action.slice(1),
  }),
);

// Fields that carry structured before→after diffs. Mirrors the `field` keys
// written in lib/actions.ts so the History list can be narrowed to "only rows
// where the status changed", etc.
const FIELD_OPTIONS: SearchSelectOption[] = [
  { value: "title", label: "Title" },
  { value: "description", label: "Description" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "dueDate", label: "Due date" },
  { value: "category", label: "Category" },
  { value: "phase", label: "Phase" },
  { value: "name", label: "Name" },
  { value: "clientName", label: "Client" },
  { value: "summary", label: "Summary" },
  { value: "deadline", label: "Deadline" },
  { value: "content", label: "Notes" },
  { value: "state", label: "Subtask state" },
  { value: "comment", label: "Comment" },
];

type Initial = {
  q: string;
  from: string;
  to: string;
  actorId: string;
  action: string;
  field: string;
};

export function ProjectHistoryFilters({
  basePath,
  actors,
  initial,
}: {
  basePath: string;
  actors: ProjectActivityActor[];
  initial: Initial;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initial.q);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [actorId, setActorId] = useState<string | undefined>(
    initial.actorId || undefined,
  );
  const [action, setAction] = useState<string | undefined>(
    initial.action || undefined,
  );
  const [field, setField] = useState<string | undefined>(
    initial.field || undefined,
  );

  const actorOptions = useMemo<SearchSelectOption[]>(
    () =>
      actors.map((actor) => ({
        value: actor.id,
        label: actor.name,
        sublabel: actor.email,
      })),
    [actors],
  );

  const hasActive =
    Boolean(q) ||
    Boolean(from) ||
    Boolean(to) ||
    Boolean(actorId) ||
    Boolean(action) ||
    Boolean(field);

  // Debounce search-text changes — push them to the URL after a brief pause
  // so each keystroke doesn't bang against the server.
  useEffect(() => {
    if (q === initial.q) return;
    const handle = window.setTimeout(() => {
      pushParams({ q });
    }, 320);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pushParams(patch: Partial<Initial>) {
    const next = new URLSearchParams(searchParams.toString());
    const apply = (key: string, value: string | undefined) => {
      if (value && value.length) next.set(key, value);
      else next.delete(key);
    };
    apply("q", patch.q ?? q);
    apply("from", patch.from ?? from);
    apply("to", patch.to ?? to);
    apply("actor", patch.actorId ?? actorId);
    apply("action", patch.action ?? action);
    apply("field", patch.field ?? field);
    router.push(`${basePath}?${next.toString()}`, { scroll: false });
  }

  function clearAll() {
    setQ("");
    setFrom("");
    setTo("");
    setActorId(undefined);
    setAction(undefined);
    setField(undefined);
    router.push(basePath, { scroll: false });
  }

  return (
    <div className="ui-panel-soft grid gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr]">
        <label className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            Search
          </span>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Label or detail…"
              className="ui-input"
              style={{ paddingLeft: 32 }}
            />
          </div>
        </label>

        <div className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            Action
          </span>
          <SearchSelect
            options={ACTION_OPTIONS}
            value={action}
            onChange={(next) => {
              setAction(next);
              pushParams({ action: next ?? "" });
            }}
            placeholder="All actions"
            searchPlaceholder="Filter actions…"
            clearLabel="All actions"
          />
        </div>

        <div className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            Field changed
          </span>
          <SearchSelect
            options={FIELD_OPTIONS}
            value={field}
            onChange={(next) => {
              setField(next);
              pushParams({ field: next ?? "" });
            }}
            placeholder="Any field"
            searchPlaceholder="Filter fields…"
            clearLabel="Any field"
          />
        </div>

        <div className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            Actor
          </span>
          <SearchSelect
            options={actorOptions}
            value={actorId}
            onChange={(next) => {
              setActorId(next);
              pushParams({ actorId: next ?? "" });
            }}
            placeholder="Everyone"
            searchPlaceholder="Search by name or email…"
            clearLabel="Everyone"
          />
        </div>

        <label className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              pushParams({ from: e.target.value });
            }}
            className="ui-input"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              pushParams({ to: e.target.value });
            }}
            className="ui-input"
          />
        </label>
      </div>

      {hasActive ? (
        <button
          type="button"
          onClick={clearAll}
          className="ui-button-ghost self-start px-3"
        >
          <X className="size-4" />
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

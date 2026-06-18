"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  CheckCircle,
  CircleNotch,
  MagnifyingGlass,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Plain, serializable shape of lib/authz's PROJECT_CAPABILITIES (passed from the
// server page so this client bundle never imports the server-only authz module).
type CapabilityDef = {
  key: string;
  label: string;
  description: string;
  group: string;
  defaultForMember: boolean;
};

type Props = {
  projectId: string;
  capabilities: CapabilityDef[];
  permissions: Record<string, boolean>;
  canManage: boolean;
};

export function MemberAccessControl({
  projectId,
  capabilities,
  permissions,
  canManage,
}: Props) {
  const [open, setOpen] = useState(false);
  const enabledCount = capabilities.filter((c) => permissions[c.key]).length;

  return (
    <section className="ui-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
            Member Access
          </h2>
          <p className="max-w-2xl text-[13px] leading-6 text-muted">
            Choose what people with the <strong className="font-medium text-foreground">Member</strong>{" "}
            role can do here. Owners, Leaders, and workspace admins always have
            full access.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ui-button-secondary shrink-0"
          >
            <ShieldCheck className="size-4" />
            Edit access
          </button>
        ) : null}
      </div>

      <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
        {enabledCount} of {capabilities.length} enabled for Members
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {capabilities.map((c) => {
          const on = permissions[c.key] === true;
          return (
            <span
              key={c.key}
              title={c.description}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em]",
                on
                  ? "border-emerald/30 bg-emerald/10 text-emerald"
                  : "border-border bg-surface text-muted line-through opacity-70",
              )}
            >
              {c.label}
            </span>
          );
        })}
      </div>

      {open ? (
        <MemberAccessModal
          projectId={projectId}
          capabilities={capabilities}
          initial={permissions}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

// Split `text` around the first case-insensitive match of `query` and wrap the
// match in a highlight. Empty query → text unchanged.
function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-accent-soft px-0.5 text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function MemberAccessModal({
  projectId,
  capabilities,
  initial,
  onClose,
}: {
  projectId: string;
  capabilities: CapabilityDef[];
  initial: Record<string, boolean>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [perms, setPerms] = useState<Record<string, boolean>>({ ...initial });
  const [query, setQuery] = useState("");
  const [saving, startSaving] = useTransition();

  const q = query.trim().toLowerCase();
  const dirty = capabilities.some((c) => Boolean(perms[c.key]) !== Boolean(initial[c.key]));

  // Group → matching capabilities, preserving catalog order. A group with no
  // matches is hidden entirely.
  const groups = useMemo(() => {
    const matches = (c: CapabilityDef) =>
      !q ||
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    const byGroup = new Map<string, CapabilityDef[]>();
    for (const c of capabilities) {
      if (!matches(c)) continue;
      if (!byGroup.has(c.group)) byGroup.set(c.group, []);
      byGroup.get(c.group)!.push(c);
    }
    return [...byGroup.entries()];
  }, [capabilities, q]);

  const matchCount = groups.reduce((n, [, items]) => n + items.length, 0);

  function save() {
    startSaving(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/member-permissions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permissions: perms }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not save.");
        toast("Member access updated", "success");
        onClose();
        router.refresh();
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not save.", "danger");
      }
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[55] p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="ui-modal-backdrop absolute inset-0 bg-[rgba(10,10,10,0.44)] backdrop-blur-xs"
      />
      <div className="relative flex min-h-full items-end justify-center sm:items-center">
        <div className="ui-modal-panel relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-border bg-surface-strong shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                Project · Member Access
              </p>
              <h3 className="mt-2 text-[17px] font-medium tracking-[-0.022em] text-foreground">
                What can Members do?
              </h3>
              <p className="mt-1 text-[13px] leading-6 text-muted">
                Toggles apply to everyone with the Member role on this project.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:border-border-strong hover:bg-surface-strong hover:text-foreground"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="border-b border-border px-5 py-3 sm:px-6">
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search access controls…"
                aria-label="Search access controls"
                autoFocus
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-[13px] text-foreground outline-none transition placeholder:text-muted focus:border-accent"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {matchCount === 0 ? (
              <p className="px-2 py-8 text-center text-[13px] text-muted">
                No access controls match “{query.trim()}”.
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map(([group, items]) => (
                  <div key={group} className="space-y-1">
                    <p className="px-2 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                      {group}
                    </p>
                    {items.map((c) => {
                      const on = perms[c.key] === true;
                      return (
                        <label
                          key={c.key}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5 transition hover:border-border-strong"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setPerms((prev) => ({
                                ...prev,
                                [c.key]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 size-4 shrink-0 rounded border-border text-accent focus:ring-accent"
                          />
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground">
                              {highlight(c.label, query)}
                            </p>
                            <p className="mt-0.5 text-[12px] leading-5 text-muted">
                              {highlight(c.description, query)}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="ui-button-ghost"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="ui-button-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <CheckCircle className="size-4" />
              )}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

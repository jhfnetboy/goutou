"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ListMagnifyingGlass, X } from "@phosphor-icons/react";

import RichTextRenderer from "@/components/rich-text/rich-text-renderer";
import type { ActivityChange } from "@/lib/db/schema";

function ValueView({
  value,
  kind,
}: {
  value: string | null;
  kind: ActivityChange["kind"];
}) {
  if (value === null) {
    return <p className="text-[13px] italic text-muted">— empty —</p>;
  }
  if (kind === "rich") {
    return <RichTextRenderer value={value} className="text-[13px]" />;
  }
  return <p className="break-words text-[13px] text-foreground">{value}</p>;
}

export function ActivityChangesButton({
  title,
  subtitle,
  changes,
}: {
  title: string;
  subtitle?: string | null;
  changes: ActivityChange[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (changes.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[11px] text-muted transition hover:border-border-strong hover:bg-surface-strong hover:text-foreground"
      >
        <ListMagnifyingGlass className="size-3.5" />
        Show details
        <span className="text-muted/70">· {changes.length}</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[55] p-4 sm:p-6">
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setOpen(false)}
                className="ui-modal-backdrop absolute inset-0 bg-[rgba(10,10,10,0.44)] backdrop-blur-xs"
              />
              <div className="relative flex min-h-full items-end justify-center sm:items-center">
                <div
                  role="dialog"
                  aria-modal="true"
                  className="ui-modal-panel relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-md border border-border bg-surface-strong shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                        What changed
                      </p>
                      <h3 className="mt-1 truncate text-[15px] font-medium tracking-[-0.011em] text-foreground">
                        {title}
                      </h3>
                      {subtitle ? (
                        <p className="mt-0.5 truncate text-[13px] text-muted">
                          {subtitle}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:border-border-strong hover:bg-surface-strong hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">Close</span>
                    </button>
                  </div>

                  <div className="grid gap-4 overflow-y-auto px-5 py-4">
                    {changes.map((change) => (
                      <div key={change.field} className="grid gap-2">
                        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                          {change.label}
                        </p>
                        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                          <div className="rounded-md border border-border bg-surface p-3">
                            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                              Before
                            </p>
                            <ValueView value={change.from} kind={change.kind} />
                          </div>
                          <div className="hidden items-center justify-center text-muted sm:flex">
                            <ArrowRight className="size-4" />
                          </div>
                          <div className="rounded-md border border-accent/30 bg-accent-soft p-3">
                            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-accent">
                              After
                            </p>
                            <ValueView value={change.to} kind={change.kind} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Check, CircleNotch } from "@phosphor-icons/react";

import { setProjectColorAction } from "@/lib/actions";
import { PROJECT_SWATCHES } from "@/lib/swatches";
import { cn } from "@/lib/utils";

export function ProjectColorPicker({
  projectId,
  currentColor,
  returnTo,
}: {
  projectId: string;
  currentColor: string | null;
  returnTo: string;
}) {
  const [selected, setSelected] = useState<string | null>(currentColor);
  const [isPending, startTransition] = useTransition();

  function commit(next: string | null) {
    setSelected(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("color", next ?? "");
      formData.set("returnTo", returnTo);
      await setProjectColorAction(formData);
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => commit(null)}
          aria-label="No color"
          aria-pressed={selected === null}
          disabled={isPending}
          className={cn(
            "relative flex size-8 items-center justify-center rounded-md border bg-background transition",
            selected === null
              ? "border-foreground"
              : "border-border hover:border-border-strong",
          )}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            —
          </span>
        </button>
        {PROJECT_SWATCHES.map((swatch) => {
          const isSelected =
            selected !== null &&
            selected.toLowerCase() === swatch.value.toLowerCase();
          return (
            <button
              key={swatch.value}
              type="button"
              onClick={() => commit(swatch.value)}
              aria-label={swatch.label}
              aria-pressed={isSelected}
              disabled={isPending}
              className={cn(
                "relative flex size-8 items-center justify-center rounded-md border transition",
                isSelected
                  ? "border-foreground"
                  : "border-border hover:border-border-strong",
              )}
              style={{ backgroundColor: swatch.value }}
            >
              {isSelected ? (
                <Check className="size-4 text-white drop-shadow-sm" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
        {isPending ? (
          <>
            <CircleNotch className="size-3 animate-spin" /> Saving…
          </>
        ) : selected ? (
          <>
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: selected }}
            />
            {selected.toUpperCase()}
          </>
        ) : (
          "No color set"
        )}
      </p>
    </div>
  );
}

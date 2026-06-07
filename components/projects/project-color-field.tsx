"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";

import { PROJECT_SWATCHES } from "@/lib/swatches";
import { cn } from "@/lib/utils";

/**
 * Swatch picker for a form (e.g. the Create Project modal). Unlike
 * ProjectColorPicker — which live-saves an existing project via a server action
 * — this only tracks local selection and writes it to a hidden input, so the
 * color is submitted together with the rest of the create form.
 */
export function ProjectColorField({
  name = "color",
  defaultValue = null,
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(defaultValue);

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={selected ?? ""} />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label="No color"
          aria-pressed={selected === null}
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
              onClick={() => setSelected(swatch.value)}
              aria-label={swatch.label}
              aria-pressed={isSelected}
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
    </div>
  );
}

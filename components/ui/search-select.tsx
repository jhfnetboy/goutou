"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type SearchSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
};

type Props = {
  options: SearchSelectOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  clearLabel,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.sublabel ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus search when opened; reset active to selected item (or first match).
  useEffect(() => {
    if (open) {
      setQuery("");
      const initialIndex = Math.max(
        0,
        options.findIndex((o) => o.value === value),
      );
      setActiveIndex(initialIndex);
      // Defer to let panel mount.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, options, value]);

  // Keep activeIndex in range as the filter changes.
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length === 0 ? -1 : 0);
    }
  }, [filtered.length, activeIndex]);

  const commit = useCallback(
    (next: string | undefined) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? -1 : (i + 1) % filtered.length,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0
          ? -1
          : (i - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        commit(filtered[activeIndex].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-[13px] transition focus:outline-none focus:ring-2 focus:ring-ring",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected ? "text-foreground" : "text-muted",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        {value ? (
          <span
            role="button"
            aria-label="Clear selection"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              commit(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                commit(undefined);
              }
            }}
            className="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-foreground"
          >
            <X className="size-3.5" />
          </span>
        ) : null}
        <CaretDown className="size-3.5 shrink-0 text-muted" />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          role="listbox"
          id={listboxId}
        >
          <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
            <MagnifyingGlass className="size-4 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {clearLabel ? (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(undefined)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition",
                    !value
                      ? "bg-accent-soft text-foreground"
                      : "text-muted hover:bg-surface-strong hover:text-foreground",
                  )}
                >
                  <span>{clearLabel}</span>
                </button>
              </li>
            ) : null}

            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-[12px] leading-5 text-muted">
                No matches.
              </li>
            ) : (
              filtered.map((option, index) => {
                const isActive = index === activeIndex;
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(option.value)}
                      onMouseEnter={() => setActiveIndex(index)}
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-[13px] transition",
                        isSelected
                          ? "bg-accent-soft text-foreground"
                          : isActive
                            ? "bg-surface-strong text-foreground"
                            : "text-foreground hover:bg-surface-strong",
                      )}
                    >
                      <span className="truncate font-medium">{option.label}</span>
                      {option.sublabel ? (
                        <span className="truncate font-mono text-[11px] text-muted">
                          {option.sublabel}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

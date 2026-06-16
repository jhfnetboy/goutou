"use client";

import { createContext, useContext, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

// Real-time settings filter: a search box at the top narrows the page to the
// section(s) whose title / description / keywords match, hiding the rest and
// highlighting the matched text.
const SettingsQueryContext = createContext("");

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() && part.length > 0 ? (
      <mark
        key={index}
        className="rounded-[3px] bg-yellow-300/40 px-0.5 text-inherit"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function SettingsSearch({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  return (
    <SettingsQueryContext.Provider value={normalized}>
      <div className="grid gap-6">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings…"
            aria-label="Search settings"
            className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-[13px] text-foreground outline-none transition placeholder:text-muted"
          />
        </div>
        {children}
      </div>
    </SettingsQueryContext.Provider>
  );
}

export function SettingsSection({
  eyebrow,
  title,
  description,
  // Extra searchable terms (e.g. the names of the controls inside the section)
  // so a query like "archive" or "delete" surfaces the right card.
  keywords,
  action,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  keywords?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const query = useContext(SettingsQueryContext);
  const haystack =
    `${eyebrow} ${title} ${description ?? ""} ${keywords ?? ""}`.toLowerCase();

  if (query && !haystack.includes(query)) return null;

  return (
    <section className={cn("ui-panel p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            {eyebrow}
          </p>
          <div>
            <h2 className="text-[17px] font-medium tracking-[-0.022em] text-foreground">
              {highlight(title, query)}
            </h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-[13px] leading-6 text-muted">
                {highlight(description, query)}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

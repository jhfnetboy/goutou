import { cn } from "@/lib/utils";

// Renders a project name as a badge tinted with the project's color. Falls back
// to the neutral `.ui-badge` look when a project has no color set. Mirrors the
// label badge styling used on task cards (color26 fill + color66 border + dot).
export function ProjectColorBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: string | null | undefined;
  className?: string;
}) {
  if (!color) {
    return (
      <span className={cn("ui-badge max-w-full truncate", className)}>
        {name}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-h-[22px] max-w-full items-center gap-1.5 truncate rounded-[4px] border px-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-foreground",
        className,
      )}
      style={{ backgroundColor: `${color}26`, borderColor: `${color}66` }}
      title={name}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

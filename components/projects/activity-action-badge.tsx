import { cn } from "@/lib/utils";

const actionStyles: Record<string, string> = {
  created: "border-emerald/30 bg-emerald/10 text-emerald",
  restored: "border-emerald/30 bg-emerald/10 text-emerald",
  updated: "border-accent/30 bg-accent-soft text-accent",
  duplicated: "border-accent/30 bg-accent-soft text-accent",
  converted: "border-accent/30 bg-accent-soft text-accent",
  moved: "border-accent/30 bg-accent-soft text-accent",
  archived: "border-border bg-surface text-muted",
  deleted: "border-danger/30 bg-danger/10 text-danger",
};

export function ActivityActionBadge({
  action,
  className,
}: {
  action: string;
  className?: string;
}) {
  const style = actionStyles[action] ?? actionStyles.archived;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em]",
        style,
        className,
      )}
    >
      {action}
    </span>
  );
}

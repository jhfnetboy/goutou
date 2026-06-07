// Build the structured before→after diffs stored on a project_activity row.
//
// Callers pre-format each side into a display string (status/priority → label,
// due date → readable date) for "text" fields, or pass the raw TipTap JSON for
// "rich" fields. diffChanges() normalizes both sides, drops no-op edits, and
// returns the ActivityChange[] persisted in the `changes` column and rendered
// by the History "Show details" modal.

import type {
  ActivityChange,
  Priority,
  ProjectStatus,
  RequestStatus,
  TaskStatus,
} from "@/lib/db/schema";
import { PROJECT_STATUS_LABELS } from "@/lib/project-status";
import { parseRichText, richTextIsEmpty } from "@/lib/rich-text";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  converted: "Converted",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function priorityLabel(value: Priority | null | undefined): string | null {
  return value ? PRIORITY_LABELS[value] : null;
}

export function taskStatusLabel(value: TaskStatus | null | undefined): string | null {
  return value ? TASK_STATUS_LABELS[value] : null;
}

export function requestStatusLabel(
  value: RequestStatus | null | undefined,
): string | null {
  return value ? REQUEST_STATUS_LABELS[value] : null;
}

export function projectStatusLabel(
  value: ProjectStatus | null | undefined,
): string | null {
  return value ? PROJECT_STATUS_LABELS[value] : null;
}

export function formatActivityDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** Collapse a rich-text value to null when it carries no meaningful content. */
function richToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return richTextIsEmpty(parseRichText(value)) ? null : value;
}

type DiffEntry = {
  field: string;
  label: string;
  from: string | null | undefined;
  to: string | null | undefined;
  kind?: "text" | "rich";
};

/**
 * Assemble the changes array for an activity row. Entries whose normalized
 * `from` equals `to` are dropped, so only fields that actually changed land in
 * history. Returns `undefined` when nothing changed so callers can omit it.
 */
export function diffChanges(entries: DiffEntry[]): ActivityChange[] | undefined {
  const changes: ActivityChange[] = [];
  for (const entry of entries) {
    const kind = entry.kind ?? "text";
    const from = kind === "rich" ? richToNull(entry.from) : emptyToNull(entry.from);
    const to = kind === "rich" ? richToNull(entry.to) : emptyToNull(entry.to);
    if (from === to) continue;
    changes.push({ field: entry.field, label: entry.label, from, to, kind });
  }
  return changes.length ? changes : undefined;
}

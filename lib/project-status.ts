// Display labels for project statuses. Storage stays kebab/snake; the UI
// prefixes "In" for active phases and renders plain for terminal states.

import type { ProjectStatus } from "@/lib/db/schema";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  production: "In Production",
  development: "In Development",
  poc: "In POC",
  on_hold: "On Hold",
  completed: "Completed",
};

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{
  value: ProjectStatus;
  label: string;
}> = [
  { value: "production", label: "In Production" },
  { value: "development", label: "In Development" },
  { value: "poc", label: "In POC" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

export function formatProjectStatus(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status];
}

import { getDb } from "@/lib/db";
import {
  type ActivityAction,
  type ActivityChange,
  type ActivityEntity,
  projectActivity,
} from "@/lib/db/schema";

type DbClient = ReturnType<typeof getDb>;

export type ActivityInput = {
  ownerId: string;
  projectId: string;
  entityType: ActivityEntity;
  entityId: string;
  action: ActivityAction;
  label: string;
  detail?: string | null;
  changes?: ActivityChange[] | null;
  createdAt?: Date;
};

// Exported so callers can include the activity insert in a db.batch([...])
// alongside the entity write, committing both atomically (no orphaned rows / no
// missing audit entries on a partial failure).
export function toActivityRow(input: ActivityInput) {
  return {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    projectId: input.projectId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    label: input.label,
    detail: input.detail ?? null,
    changes: input.changes && input.changes.length ? input.changes : null,
    createdAt: input.createdAt ?? new Date(),
  };
}

export async function logProjectActivity(db: DbClient, input: ActivityInput) {
  await db.insert(projectActivity).values(toActivityRow(input));
}

export async function logProjectActivities(
  db: DbClient,
  inputs: ActivityInput[],
) {
  if (!inputs.length) {
    return;
  }

  await db.insert(projectActivity).values(inputs.map(toActivityRow));
}

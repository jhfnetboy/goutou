import { getDb } from "@/lib/db";
import { notifications, type NotificationTone } from "@/lib/db/schema";

type DbClient = ReturnType<typeof getDb>;

export type NotificationInput = {
  recipientId: string;
  actorId: string | null;
  type: string;
  tone?: NotificationTone;
  title: string;
  body?: string | null;
  href: string;
  entityType: string;
  entityId: string;
};

function toNotificationRow(input: NotificationInput) {
  return {
    id: crypto.randomUUID(),
    recipientId: input.recipientId,
    actorId: input.actorId ?? null,
    type: input.type,
    tone: input.tone ?? ("default" as NotificationTone),
    title: input.title,
    body: input.body ?? null,
    href: input.href,
    entityType: input.entityType,
    entityId: input.entityId,
    readAt: null,
    createdAt: new Date(),
  };
}

// Never notify a user about their own action.
function isSelf(input: NotificationInput) {
  return Boolean(input.actorId) && input.actorId === input.recipientId;
}

export async function createNotification(db: DbClient, input: NotificationInput) {
  if (isSelf(input)) return;
  await db.insert(notifications).values(toNotificationRow(input));
}

export async function createNotifications(
  db: DbClient,
  inputs: NotificationInput[],
) {
  const rows = inputs.filter((input) => !isSelf(input)).map(toNotificationRow);
  if (!rows.length) return;
  await db.insert(notifications).values(rows);
}

-- Persistent, event-driven notifications for directed daily-task changes.
-- Unlike the computed bell items (derived from task/request state on every
-- read), these are WRITTEN at the moment of the action, so deletions and
-- adhoc (project-less) items can still notify. Merged into the bell at read
-- time alongside the computed items.

CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "recipient_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "actor_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "type" TEXT NOT NULL,
  "tone" TEXT NOT NULL DEFAULT 'default',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "read_at" INTEGER,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX "notifications_recipient_idx"
  ON "notifications" ("recipient_id");
CREATE INDEX "notifications_recipient_created_idx"
  ON "notifications" ("recipient_id", "created_at");

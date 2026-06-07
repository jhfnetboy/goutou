ALTER TABLE "projects" ADD COLUMN "archived_at" INTEGER;

CREATE TABLE IF NOT EXISTS "project_activity" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "entity_type" TEXT NOT NULL CHECK ("entity_type" IN ('project', 'request', 'task', 'note')),
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL CHECK ("action" IN ('created', 'updated', 'deleted', 'archived', 'restored', 'duplicated', 'converted', 'moved')),
  "label" TEXT NOT NULL,
  "detail" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS "project_activity_owner_idx" ON "project_activity" ("owner_id");
CREATE INDEX IF NOT EXISTS "project_activity_project_idx" ON "project_activity" ("project_id");
CREATE INDEX IF NOT EXISTS "project_activity_created_idx" ON "project_activity" ("created_at");

CREATE TABLE IF NOT EXISTS "task_checklist_items" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "is_completed" INTEGER NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS "task_checklist_items_task_idx" ON "task_checklist_items" ("task_id");
CREATE INDEX IF NOT EXISTS "task_checklist_items_project_idx" ON "task_checklist_items" ("project_id");
CREATE INDEX IF NOT EXISTS "task_checklist_items_owner_idx" ON "task_checklist_items" ("owner_id");
CREATE INDEX IF NOT EXISTS "task_checklist_items_sort_idx" ON "task_checklist_items" ("task_id", "sort_order");

CREATE TABLE IF NOT EXISTS "project_status_updates" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "summary" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_status_updates_task_idx" ON "project_status_updates" ("task_id");
CREATE INDEX IF NOT EXISTS "project_status_updates_project_idx" ON "project_status_updates" ("project_id");
CREATE INDEX IF NOT EXISTS "project_status_updates_owner_idx" ON "project_status_updates" ("owner_id");
CREATE INDEX IF NOT EXISTS "project_status_updates_created_idx" ON "project_status_updates" ("created_at");

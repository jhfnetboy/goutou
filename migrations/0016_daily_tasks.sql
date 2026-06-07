-- Daily Ops planner. Per-user, per-day planned work items. Additive: does not
-- touch tasks/board. project_id and linked_task_id are nullable (adhoc items
-- have neither). linked_task_id binds an item to a project's Execution Board
-- (push = new card, pull = existing card); SET NULL on both project_id and
-- linked_task_id so deleting either side never erases someone's day-plan.

CREATE TABLE "daily_tasks" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "planned_date" INTEGER NOT NULL,            -- start-of-day, ms
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'todo',      -- todo | doing | done
  "priority" TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high
  "kind" TEXT NOT NULL DEFAULT 'adhoc',       -- adhoc | project
  "project_id" TEXT,
  "linked_task_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "batch_id" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY ("owner_id")       REFERENCES "user"("id")     ON DELETE CASCADE,
  FOREIGN KEY ("created_by_id")  REFERENCES "user"("id")     ON DELETE SET NULL,
  FOREIGN KEY ("project_id")     REFERENCES "projects"("id") ON DELETE SET NULL,
  FOREIGN KEY ("linked_task_id") REFERENCES "tasks"("id")    ON DELETE SET NULL
);

CREATE INDEX "daily_tasks_owner_date_idx"      ON "daily_tasks" ("owner_id", "planned_date");
CREATE INDEX "daily_tasks_date_idx"            ON "daily_tasks" ("planned_date");
CREATE INDEX "daily_tasks_linked_task_idx"     ON "daily_tasks" ("linked_task_id");
CREATE INDEX "daily_tasks_project_idx"         ON "daily_tasks" ("project_id");
CREATE INDEX "daily_tasks_batch_idx"           ON "daily_tasks" ("batch_id");
CREATE INDEX "daily_tasks_owner_date_sort_idx" ON "daily_tasks" ("owner_id", "planned_date", "sort_order");

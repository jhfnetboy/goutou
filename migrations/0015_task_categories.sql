-- Promote category from per-task freeform name+color to first-class entity
-- with one row per (project, distinct name). Existing tasks keep their
-- category_name / category_color columns as a denormalized cache during
-- the transition; new code reads from category_id.

CREATE TABLE "task_categories" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "task_categories_project_name_idx"
  ON "task_categories" ("project_id", "name");
CREATE INDEX "task_categories_project_idx"
  ON "task_categories" ("project_id");

ALTER TABLE "tasks" ADD COLUMN "category_id" TEXT
  REFERENCES "task_categories"("id") ON DELETE SET NULL;
CREATE INDEX "tasks_category_idx" ON "tasks" ("category_id");

-- Backfill: dedupe existing (project_id, category_name) pairs into the new
-- table. lower(name) avoids creating duplicates for "Design" vs "design".
-- Storage normalises to the first-seen casing.
INSERT INTO "task_categories" (id, project_id, name, color, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  project_id,
  category_name,
  COALESCE(category_color, '#8a8f98'),
  unixepoch() * 1000,
  unixepoch() * 1000
FROM (
  SELECT
    project_id,
    category_name,
    -- Use the most-recent non-null color for the dedup row.
    (SELECT category_color
       FROM tasks t2
      WHERE t2.project_id = t.project_id
        AND lower(t2.category_name) = lower(t.category_name)
        AND t2.category_color IS NOT NULL
      ORDER BY t2.updated_at DESC
      LIMIT 1) AS category_color
  FROM tasks t
  WHERE category_name IS NOT NULL
    AND category_name != ''
  GROUP BY project_id, lower(category_name)
);

-- Link each task to its category by (project_id, name).
UPDATE tasks
SET category_id = (
  SELECT tc.id
  FROM task_categories tc
  WHERE tc.project_id = tasks.project_id
    AND lower(tc.name) = lower(tasks.category_name)
  LIMIT 1
)
WHERE category_name IS NOT NULL AND category_name != '';

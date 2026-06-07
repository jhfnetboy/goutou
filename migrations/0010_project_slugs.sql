-- Project key (slug) + per-project running numbers for tasks and requests.
-- Display codes are computed at render time as "<slug>-<n>" (tasks) and
-- "<slug>-CR-<n>" (requests). Counters never re-use deleted numbers — we
-- always allocate max(code_number)+1 per project.
--
-- Slugs are populated by scripts/backfill-project-slugs.ts after this
-- migration runs (human-reviewable). Task/request numbers are backfilled
-- here using window functions in created_at order.

ALTER TABLE projects ADD COLUMN slug TEXT;
ALTER TABLE tasks ADD COLUMN code_number INTEGER;
ALTER TABLE client_requests ADD COLUMN code_number INTEGER;

-- Backfill task code_number: oldest task per project = 1, 2, 3, ...
UPDATE tasks
SET code_number = (
  SELECT rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY created_at, id
    ) AS rn
    FROM tasks
  ) ranked
  WHERE ranked.id = tasks.id
);

UPDATE client_requests
SET code_number = (
  SELECT rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY created_at, id
    ) AS rn
    FROM client_requests
  ) ranked
  WHERE ranked.id = client_requests.id
);

-- Unique indices. Nulls are allowed (rows without slugs / numbers) but two
-- non-null duplicates would conflict — which is exactly what we want.
CREATE UNIQUE INDEX projects_slug_idx ON projects(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX tasks_project_code_idx ON tasks(project_id, code_number) WHERE code_number IS NOT NULL;
CREATE UNIQUE INDEX requests_project_code_idx ON client_requests(project_id, code_number) WHERE code_number IS NOT NULL;

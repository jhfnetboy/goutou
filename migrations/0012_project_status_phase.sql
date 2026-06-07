-- Project status overhaul: phase-based statuses replace the old lifecycle set.
--   active    → development  (per user spec)
--   planned   → development  (close enough to "we're about to build it")
--   paused    → on_hold      (renamed)
--   completed → completed    (kept)
-- New values: production, development, poc, on_hold, completed.
--
-- The status column has a CHECK constraint baked into the table, so we
-- rebuild the table with the new constraint. FKs from child tables stay
-- pointed at the same id values; the rename swap is transparent to them.

-- Defer FK enforcement for this rebuild (matches 0001): child tables reference
-- projects(id), so DROP/RENAME must not trip foreign_keys if a runner has it on.
PRAGMA defer_foreign_keys = true;

CREATE TABLE projects_new (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "client_name" TEXT,
  "summary" TEXT,
  "status" TEXT NOT NULL DEFAULT 'development' CHECK ("status" IN ('production', 'development', 'poc', 'on_hold', 'completed')),
  "deadline" INTEGER,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "archived_at" INTEGER,
  "color" TEXT,
  "slug" TEXT,
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE
);

INSERT INTO projects_new
  (id, owner_id, name, client_name, summary, status, deadline, created_at, updated_at, archived_at, color, slug)
SELECT
  id, owner_id, name, client_name, summary,
  CASE status
    WHEN 'active'    THEN 'development'
    WHEN 'planned'   THEN 'development'
    WHEN 'paused'    THEN 'on_hold'
    ELSE status
  END,
  deadline, created_at, updated_at, archived_at, color, slug
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX projects_owner_idx ON projects(owner_id);
CREATE INDEX projects_status_idx ON projects(status);
CREATE UNIQUE INDEX projects_slug_idx ON projects(slug) WHERE slug IS NOT NULL;

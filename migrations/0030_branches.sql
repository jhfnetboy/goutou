-- Git-like branches for a project's work. A branch scopes tasks AND requests
-- (requirements), so Main and a feature branch show a different set of work.
-- Every project gets exactly one default "Main" branch; tasks and requests gain
-- a branch_id pointing at it. Project-config and social entities (labels,
-- categories, members, notes, comments, checklist, activity) stay project-scoped
-- and inherit a branch transitively through their parent task/request.
--
-- branch_id is added NULLABLE because SQLite cannot ALTER ADD a NOT NULL column
-- with a non-constant (FK) default; the app layer guarantees every write sets it
-- and this migration backfills all existing rows to each project's Main branch.

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX branches_project_idx ON branches(project_id);
CREATE UNIQUE INDEX branches_project_name_idx ON branches(project_id, name);
CREATE UNIQUE INDEX branches_project_default_idx ON branches(project_id) WHERE is_default = 1;

-- One default "Main" branch per existing project, owned by the project owner.
INSERT INTO branches (id, project_id, name, description, created_by, is_default)
SELECT lower(hex(randomblob(16))), p.id, 'Main', NULL, p.owner_id, 1
FROM projects p;

-- Tasks: add nullable branch_id, then point every existing task at its Main branch.
ALTER TABLE tasks ADD COLUMN branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE;
UPDATE tasks
SET branch_id = (
  SELECT b.id FROM branches b
  WHERE b.project_id = tasks.project_id AND b.is_default = 1
);
CREATE INDEX tasks_branch_idx ON tasks(branch_id);
CREATE INDEX tasks_branch_status_sort_idx ON tasks(branch_id, status, sort_order);

-- Requests (requirements): same treatment — per-branch.
ALTER TABLE client_requests ADD COLUMN branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE;
UPDATE client_requests
SET branch_id = (
  SELECT b.id FROM branches b
  WHERE b.project_id = client_requests.project_id AND b.is_default = 1
);
CREATE INDEX requests_branch_idx ON client_requests(branch_id);

-- Multi-tag labels for tasks. Like task_categories (reusable per-project name +
-- color) but many-to-many: a task can carry several labels. Label membership
-- lives in the task_task_labels join table rather than denormalized onto tasks,
-- so adding/removing a label never rewrites the task row. Deleting a project
-- cascades to its labels; deleting a label or task cascades to the join rows.

CREATE TABLE task_labels (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX task_labels_project_name_idx ON task_labels(project_id, name);
CREATE INDEX task_labels_project_idx ON task_labels(project_id);

CREATE TABLE task_task_labels (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX task_task_labels_task_label_idx ON task_task_labels(task_id, label_id);
CREATE INDEX task_task_labels_label_idx ON task_task_labels(label_id);

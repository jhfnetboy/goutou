-- Phase 3: task assignments. A task can be assigned to a specific user
-- (typically a project member). Null = unassigned.

ALTER TABLE tasks ADD COLUMN assignee_id TEXT REFERENCES user(id) ON DELETE SET NULL;

CREATE INDEX tasks_assignee_idx ON tasks(assignee_id);

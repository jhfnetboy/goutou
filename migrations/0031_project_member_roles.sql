-- Per-project member roles. The project Owner stays implicit (projects.owner_id),
-- so this column only distinguishes "leader" (runs the project: config, content,
-- can add Members) from "member" (does task/request work). Existing members
-- default to "member"; an owner can promote them. NOT NULL with a constant
-- default is allowed by SQLite's ALTER ... ADD COLUMN.
ALTER TABLE project_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';

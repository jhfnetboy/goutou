-- Phase 1: multi-user foundation.
-- Adds user.role, project_members join, and invitations table.
-- Promotes the existing seeded user (single owner) to role='owner'.

ALTER TABLE user ADD COLUMN role TEXT NOT NULL DEFAULT 'member';

-- The seeded admin is the only pre-existing user; promote them to owner.
-- No-op if the table is empty (fresh DB seeded after migration).
UPDATE user
SET role = 'owner'
WHERE id = (SELECT id FROM user ORDER BY created_at ASC LIMIT 1);

CREATE TABLE project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  added_by_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX project_members_project_user_idx
  ON project_members(project_id, user_id);
CREATE INDEX project_members_user_idx ON project_members(user_id);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX invitations_token_idx ON invitations(token);
CREATE INDEX invitations_email_idx ON invitations(email);

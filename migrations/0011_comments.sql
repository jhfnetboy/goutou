-- Comment threads on tasks and client requests. Content is stored as TipTap
-- JSON (ProseMirror doc tree) so we can render rich formatting and images
-- without an HTML sanitizer. project_id is denormalized for query scoping.

CREATE TABLE task_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX task_comments_task_idx ON task_comments(task_id);
CREATE INDEX task_comments_project_idx ON task_comments(project_id);
CREATE INDEX task_comments_author_idx ON task_comments(author_id);
CREATE INDEX task_comments_created_idx ON task_comments(created_at);

CREATE TABLE request_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX request_comments_request_idx ON request_comments(request_id);
CREATE INDEX request_comments_project_idx ON request_comments(project_id);
CREATE INDEX request_comments_author_idx ON request_comments(author_id);
CREATE INDEX request_comments_created_idx ON request_comments(created_at);

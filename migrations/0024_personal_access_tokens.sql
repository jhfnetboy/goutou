-- Personal access tokens (PATs) for programmatic / MCP access. A token
-- authenticates as its owning user with a read or readwrite scope; it can never
-- exceed that user's own project access. Only a SHA-256 hash of the full token
-- is stored (token_hash) — the raw value is shown once at creation and never
-- persisted. token_prefix holds the leading chars for display. Deleting a user
-- cascades, mirroring session/account.

CREATE TABLE personal_access_token (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'readwrite')),
  last_used_at INTEGER,
  expires_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX personal_access_token_hash_idx ON personal_access_token(token_hash);
CREATE INDEX personal_access_token_user_idx ON personal_access_token(user_id, created_at);

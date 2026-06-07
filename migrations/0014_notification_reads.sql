-- Per-user read state for derived notifications. Notifications themselves
-- are computed on the fly (no notifications table); we just remember which
-- ones each user has acknowledged via their stable derived id.

CREATE TABLE notification_reads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  read_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX notification_reads_user_notif_idx
  ON notification_reads(user_id, notification_id);

CREATE INDEX notification_reads_user_idx ON notification_reads(user_id);

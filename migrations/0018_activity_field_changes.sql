-- Field-level history: structured before→after diffs per activity event.
-- Stored as a JSON array of { field, label, from, to, kind } so the project
-- History "Show details" modal can render exactly what changed (status,
-- priority, due date, title, description, etc.) instead of just "updated".
-- Nullable + backward compatible — existing rows keep no structured changes.

ALTER TABLE "project_activity" ADD COLUMN "changes" TEXT;

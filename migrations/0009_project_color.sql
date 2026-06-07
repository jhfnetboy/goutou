-- Per-project brand color. NULL = no color (neutral, default fallback).
-- Validated server-side against the shared swatch palette.

ALTER TABLE projects ADD COLUMN color TEXT;

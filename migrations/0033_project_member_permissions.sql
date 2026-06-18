-- Per-project overrides for what the "member" role may do. Stored as a JSON map
-- of capability-key → boolean (see PROJECT_CAPABILITIES in lib/authz). NULL — the
-- default for every existing and new project — means "use the code defaults", so
-- behavior is unchanged until an owner/leader edits the Member Access toggles.
-- Owners, Leaders, and workspace admins are never gated by this column.
ALTER TABLE projects ADD COLUMN member_permissions TEXT;

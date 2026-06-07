-- Soft-delete / deactivate for users. When `disabled_at` is set, the user is
-- locked out of every guarded route (getViewer() returns null) and their
-- sessions are purged on deactivation. Nullable + backward compatible —
-- existing users are active (NULL). Reactivating clears the column.

ALTER TABLE "user" ADD COLUMN "disabled_at" INTEGER;

-- Opt-in, rotatable public client board. Previously every project was
-- implicitly readable at /client/<project-id>, with no way to disable or
-- rotate the link. The board is now private until the owner enables it, and is
-- reached via a separate, rotatable share token (not the project id).
--
-- Existing projects default to disabled (private), so old /client/<project-id>
-- links stop working until the owner opts in and shares the new token URL.

ALTER TABLE "projects" ADD COLUMN "client_share_enabled" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN "client_share_token" TEXT;

CREATE UNIQUE INDEX "projects_client_share_token_idx"
  ON "projects" ("client_share_token") WHERE "client_share_token" IS NOT NULL;

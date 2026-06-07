ALTER TABLE "task_checklist_items" ADD COLUMN "completed_at" INTEGER;
UPDATE "task_checklist_items" SET "completed_at" = "updated_at" WHERE "is_completed" = 1;
CREATE INDEX "task_checklist_items_completed_at_idx" ON "task_checklist_items" ("completed_at");

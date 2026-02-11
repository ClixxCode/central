ALTER TABLE "tasks" ADD COLUMN "archived_at" timestamp;
CREATE INDEX "tasks_archived_at_idx" ON "tasks" ("archived_at") WHERE "archived_at" IS NOT NULL;
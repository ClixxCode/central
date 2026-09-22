-- Agentic builds: archive-with-reason.
-- A build leaves the Agentic Builds board by being archived with an explicit
-- reason (archivedAt is the existing task archive timestamp; these three columns
-- record why, any free-text context, and who did it). Soft by design — the
-- build's build_stage_events rows survive so abandoned effort still counts as a
-- duration datapoint for Pulse's pricing engine.
-- Written idempotent (IF NOT EXISTS) to match 0034/0035/0037: the live Central
-- DB is migrated out-of-band because deploy runs `next build` with no db:migrate.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "build_archive_reason" varchar(32);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "build_archive_note" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "build_archived_by" uuid REFERENCES "public"."users"("id") ON DELETE set null;
--> statement-breakpoint
-- Drives the "Archived" drawer on the builds board.
CREATE INDEX IF NOT EXISTS "tasks_agentic_build_archived_idx" ON "tasks" ("archived_at") WHERE "is_agentic_build" = true;

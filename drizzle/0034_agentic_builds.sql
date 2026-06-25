-- Agentic website builds: flag + pipeline stage on tasks.
-- A build is a normal task (lives on its client's board) flagged here, with a
-- build_stage independent of the board status. The standalone Agentic Website
-- Builds board re-groups these by stage. Applied to the live DB out-of-band.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "is_agentic_build" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "build_stage" varchar(50);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_agentic_build_idx" ON "tasks" ("build_stage") WHERE "is_agentic_build" = true;

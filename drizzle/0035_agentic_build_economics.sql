-- Agentic build economics: classification, project value, commencement, and a
-- stage-transition log for time-in-stage / total-duration analytics.
-- Written idempotent (IF NOT EXISTS) because is_agentic_build/build_stage were
-- already applied in 0034 and are omitted here.

CREATE TABLE IF NOT EXISTS "build_stage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL REFERENCES "public"."tasks"("id") ON DELETE cascade,
	"stage" varchar(50) NOT NULL,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"moved_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "build_type" varchar(32);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "project_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "commencement_date" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "build_stage_events_task_idx" ON "build_stage_events" USING btree ("task_id","entered_at");

CREATE TABLE "async_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"kind" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"claimed_by" varchar(100),
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp,
	"completed_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "async_jobs_dedupe_key_idx" ON "async_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "async_jobs_status_locked_at_idx" ON "async_jobs" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "async_jobs_kind_status_idx" ON "async_jobs" USING btree ("kind","status");
ALTER TABLE "tasks" ADD COLUMN "short_id" varchar(12);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_short_id_unique" UNIQUE("short_id");
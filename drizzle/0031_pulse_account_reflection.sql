-- Pulse → Central account reflection (status/type/pod/team) + join keys.
-- NOTE: these columns/indexes were also applied directly to the live Central
-- database (Clix Central Supabase project) out-of-band; IF NOT EXISTS keeps
-- this migration safe to run against that already-updated database.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pulse_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "pulse_account_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "account_status" varchar(32);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "account_type" varchar(32);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "pod_name" varchar(64);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "pod_sub_context" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "account_team" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "pulse_synced_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_pulse_account_id_key" ON "clients" ("pulse_account_id") WHERE "pulse_account_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_pulse_staff_id_key" ON "users" ("pulse_staff_id") WHERE "pulse_staff_id" IS NOT NULL;

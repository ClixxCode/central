CREATE TYPE "public"."rollup_invitation_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "color_format_check" CHECK ("statuses"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "color_format_check" CHECK ("sections"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "rollup_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rollup_board_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"all_users" boolean DEFAULT false NOT NULL,
	"status" "rollup_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_target_check" CHECK ((
        ("rollup_invitations"."user_id" IS NOT NULL AND "rollup_invitations"."team_id" IS NULL AND "rollup_invitations"."all_users" = false) OR
        ("rollup_invitations"."user_id" IS NULL AND "rollup_invitations"."team_id" IS NOT NULL AND "rollup_invitations"."all_users" = false) OR
        ("rollup_invitations"."user_id" IS NULL AND "rollup_invitations"."team_id" IS NULL AND "rollup_invitations"."all_users" = true)
      ))
);
--> statement-breakpoint
CREATE TABLE "rollup_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rollup_board_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_user_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "rollup_invitations" ADD CONSTRAINT "rollup_invitations_rollup_board_id_boards_id_fk" FOREIGN KEY ("rollup_board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollup_invitations" ADD CONSTRAINT "rollup_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollup_invitations" ADD CONSTRAINT "rollup_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollup_invitations" ADD CONSTRAINT "rollup_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollup_owners" ADD CONSTRAINT "rollup_owners_rollup_board_id_boards_id_fk" FOREIGN KEY ("rollup_board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollup_owners" ADD CONSTRAINT "rollup_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_user_id_users_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE TYPE "public"."saved_view_invitation_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "saved_view_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"view_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"all_users" boolean DEFAULT false NOT NULL,
	"status" "saved_view_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_view_invite_target_check" CHECK ((
        ("saved_view_invitations"."user_id" IS NOT NULL AND "saved_view_invitations"."team_id" IS NULL AND "saved_view_invitations"."all_users" = false) OR
        ("saved_view_invitations"."user_id" IS NULL AND "saved_view_invitations"."team_id" IS NOT NULL AND "saved_view_invitations"."all_users" = false) OR
        ("saved_view_invitations"."user_id" IS NULL AND "saved_view_invitations"."team_id" IS NULL AND "saved_view_invitations"."all_users" = true)
      ))
);
--> statement-breakpoint
CREATE TABLE "saved_view_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"view_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_view_sources" (
	"view_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	CONSTRAINT "saved_view_sources_view_id_board_id_pk" PRIMARY KEY("view_id","board_id")
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"presentation" jsonb DEFAULT '{"layout":"swimlane","sort":{"field":"position","direction":"asc"},"tableColumns":{"title":true,"status":true,"section":true,"assignees":true,"dueDate":true,"source":true},"cardFields":{"section":true,"dueDate":true,"assignees":true}}'::jsonb NOT NULL,
	"review_mode_enabled" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "valid_entity_type";--> statement-breakpoint
ALTER TABLE "saved_view_invitations" ADD CONSTRAINT "saved_view_invitations_view_id_saved_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_invitations" ADD CONSTRAINT "saved_view_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_invitations" ADD CONSTRAINT "saved_view_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_invitations" ADD CONSTRAINT "saved_view_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_owners" ADD CONSTRAINT "saved_view_owners_view_id_saved_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_owners" ADD CONSTRAINT "saved_view_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_sources" ADD CONSTRAINT "saved_view_sources_view_id_saved_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_sources" ADD CONSTRAINT "saved_view_sources_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_view_invitations_view_idx" ON "saved_view_invitations" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "saved_view_invitations_user_idx" ON "saved_view_invitations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_view_invitations_team_idx" ON "saved_view_invitations" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_view_owners_view_user_idx" ON "saved_view_owners" USING btree ("view_id","user_id");--> statement-breakpoint
CREATE INDEX "saved_view_owners_user_idx" ON "saved_view_owners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_view_sources_board_idx" ON "saved_view_sources" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "saved_views_created_by_idx" ON "saved_views" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "valid_entity_type" CHECK ("favorites"."entity_type" IN ('board', 'rollup', 'view'));

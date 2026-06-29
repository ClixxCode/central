ALTER TYPE "public"."board_type" ADD VALUE 'project';--> statement-breakpoint
CREATE TABLE "board_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_board_id" uuid NOT NULL,
	"project_board_id" uuid NOT NULL,
	"status" varchar(100) NOT NULL,
	"section" varchar(100),
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	CONSTRAINT "board_projects_distinct_boards_check" CHECK ("board_projects"."parent_board_id" <> "board_projects"."project_board_id")
);
--> statement-breakpoint
ALTER TABLE "board_projects" ADD CONSTRAINT "board_projects_parent_board_id_boards_id_fk" FOREIGN KEY ("parent_board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_projects" ADD CONSTRAINT "board_projects_project_board_id_boards_id_fk" FOREIGN KEY ("project_board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_projects" ADD CONSTRAINT "board_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_projects_project_board_id_unique" ON "board_projects" USING btree ("project_board_id");
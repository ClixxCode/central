CREATE TABLE "board_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(20) DEFAULT 'board_template' NOT NULL,
	"icon" varchar(100),
	"color" varchar(7),
	"status_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"section_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" jsonb,
	"status" varchar(100),
	"section" varchar(100),
	"relative_due_days" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"parent_template_task_id" uuid
);
--> statement-breakpoint
ALTER TABLE "board_templates" ADD CONSTRAINT "board_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_template_id_board_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."board_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_tasks" ADD CONSTRAINT "template_tasks_parent_template_task_id_template_tasks_id_fk" FOREIGN KEY ("parent_template_task_id") REFERENCES "public"."template_tasks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "clients" DROP CONSTRAINT "clients_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "boards" DROP CONSTRAINT "boards_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
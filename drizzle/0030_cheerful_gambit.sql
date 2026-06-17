CREATE TABLE "notification_email_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"send_after" timestamp NOT NULL,
	"sent_at" timestamp,
	"skipped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_email_batches" ADD CONSTRAINT "notification_email_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_email_batches_pending_user_channel_idx" ON "notification_email_batches" USING btree ("user_id","channel") WHERE "notification_email_batches"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "notification_email_batches_pending_send_after_idx" ON "notification_email_batches" USING btree ("status","send_after");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_email_batch_id_notification_email_batches_id_fk" FOREIGN KEY ("email_batch_id") REFERENCES "public"."notification_email_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_email_batch_id_idx" ON "notifications" USING btree ("email_batch_id");
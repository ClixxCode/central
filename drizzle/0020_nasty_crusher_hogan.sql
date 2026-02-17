CREATE TABLE "extension_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"name" varchar(255),
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "extension_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "front_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"subject" varchar(500),
	"status" varchar(50),
	"last_message_at" timestamp,
	"message_count" integer,
	"linked_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "front_conversations_task_conversation" UNIQUE("task_id","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "front_conversations" ADD CONSTRAINT "front_conversations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "front_conversations" ADD CONSTRAINT "front_conversations_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
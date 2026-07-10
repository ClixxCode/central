CREATE TABLE "mcp_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"access_token_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"tool_name" varchar(255),
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_authorization_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"code_challenge" varchar(128) NOT NULL,
	"code_challenge_method" varchar(10) DEFAULT 'S256' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"allowed_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_access_tokens" ADD CONSTRAINT "mcp_access_tokens_client_id_mcp_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_access_tokens" ADD CONSTRAINT "mcp_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_client_id_mcp_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_audit_events" ADD CONSTRAINT "mcp_audit_events_access_token_id_mcp_access_tokens_id_fk" FOREIGN KEY ("access_token_id") REFERENCES "public"."mcp_access_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_client_id_mcp_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_access_tokens_token_hash_idx" ON "mcp_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mcp_access_tokens_user_client_idx" ON "mcp_access_tokens" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "mcp_audit_events_user_created_idx" ON "mcp_audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_audit_events_client_created_idx" ON "mcp_audit_events" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_audit_events_event_created_idx" ON "mcp_audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_authorization_codes_code_hash_idx" ON "mcp_authorization_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "mcp_authorization_codes_client_expires_idx" ON "mcp_authorization_codes" USING btree ("client_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_oauth_clients_client_id_idx" ON "mcp_oauth_clients" USING btree ("client_id");

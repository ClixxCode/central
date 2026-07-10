CREATE TABLE "mcp_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"rotated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_refresh_tokens" ADD CONSTRAINT "mcp_refresh_tokens_client_id_mcp_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."mcp_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_refresh_tokens" ADD CONSTRAINT "mcp_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_refresh_tokens_token_hash_idx" ON "mcp_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mcp_refresh_tokens_family_idx" ON "mcp_refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "mcp_refresh_tokens_user_client_idx" ON "mcp_refresh_tokens" USING btree ("user_id","client_id");
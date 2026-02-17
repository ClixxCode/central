ALTER TABLE "comments" ADD COLUMN "short_id" varchar(12);--> statement-breakpoint
CREATE UNIQUE INDEX "comments_short_id_unique" ON "comments" USING btree ("short_id");

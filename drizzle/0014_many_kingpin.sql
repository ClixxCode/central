ALTER TYPE "public"."board_type" ADD VALUE 'personal';--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "icon" varchar(100);

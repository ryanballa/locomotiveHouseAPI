ALTER TABLE "issues" RENAME COLUMN "name" TO "title";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "status" text NOT NULL;
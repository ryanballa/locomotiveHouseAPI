ALTER TABLE "issues" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "towers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
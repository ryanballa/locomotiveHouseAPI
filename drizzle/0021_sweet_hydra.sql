CREATE TABLE IF NOT EXISTS "tower_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"tower_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"description" text,
	"report_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "towers" ALTER COLUMN "owner_id" DROP DEFAULT;
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tower_reports" ADD CONSTRAINT "tower_reports_tower_id_towers_id_fk" FOREIGN KEY ("tower_id") REFERENCES "public"."towers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tower_reports" ADD CONSTRAINT "tower_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

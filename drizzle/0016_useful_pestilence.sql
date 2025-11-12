CREATE TABLE IF NOT EXISTS "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"tower_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "towers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"club_id" integer NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues" ADD CONSTRAINT "issues_tower_id_towers_id_fk" FOREIGN KEY ("tower_id") REFERENCES "public"."towers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issues" ADD CONSTRAINT "issues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "towers" ADD CONSTRAINT "towers_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

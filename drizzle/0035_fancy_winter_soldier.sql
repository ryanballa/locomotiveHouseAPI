CREATE TABLE IF NOT EXISTS "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"club_id" integer NOT NULL,
	"name" text,
	"email" text,
	"schedule" timestamp,
	"occupation" text,
	"interested_scale" text,
	"special_interests" text,
	"has_home_layout" boolean,
	"collection_size" text,
	"has_other_model_railroad_associations" boolean,
	"will_agree_to_club_rules" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "hero_image" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

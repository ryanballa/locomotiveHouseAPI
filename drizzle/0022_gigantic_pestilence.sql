CREATE TABLE IF NOT EXISTS "scheduled_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule" timestamp NOT NULL,
	"club_id" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

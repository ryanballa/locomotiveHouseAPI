CREATE TABLE IF NOT EXISTS "users_to_clubs" (
	"user_id" integer NOT NULL,
	"club_id" integer NOT NULL,
	CONSTRAINT "users_to_clubs_user_id_club_id_pk" PRIMARY KEY("user_id","club_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_to_clubs" ADD CONSTRAINT "users_to_clubs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_to_clubs" ADD CONSTRAINT "users_to_clubs_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

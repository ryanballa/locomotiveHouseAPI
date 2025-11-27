ALTER TABLE "appointments" ADD COLUMN "scheduled_session_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_scheduled_session_id_scheduled_sessions_id_fk" FOREIGN KEY ("scheduled_session_id") REFERENCES "public"."scheduled_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

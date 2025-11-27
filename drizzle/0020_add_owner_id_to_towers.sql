DO $$ BEGIN
 ALTER TABLE "towers" ADD COLUMN "owner_id" integer NOT NULL DEFAULT 1;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "towers" ADD CONSTRAINT "towers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

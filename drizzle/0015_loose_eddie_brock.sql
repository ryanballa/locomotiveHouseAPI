ALTER TABLE "invite_tokens" ADD COLUMN "role_permission" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_role_permission_permissions_id_fk" FOREIGN KEY ("role_permission") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

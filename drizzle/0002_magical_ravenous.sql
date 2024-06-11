CREATE TABLE IF NOT EXISTS "consists" (
	"id" serial PRIMARY KEY NOT NULL,
	"int1" integer DEFAULT 3 NOT NULL,
	"boolean" boolean NOT NULL,
	"owner" text NOT NULL
);

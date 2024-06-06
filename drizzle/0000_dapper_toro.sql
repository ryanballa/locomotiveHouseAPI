CREATE TABLE IF NOT EXISTS "addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"int1" integer DEFAULT 3,
	"description" text,
	"boolean" boolean,
	"owner" text
);

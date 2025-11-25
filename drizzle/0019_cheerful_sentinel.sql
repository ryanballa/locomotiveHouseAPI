CREATE TABLE IF NOT EXISTS "email_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"html_body" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

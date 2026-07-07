ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_test_user" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
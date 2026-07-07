ALTER TABLE "users" ADD COLUMN "username" text UNIQUE;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" USING btree ("username");

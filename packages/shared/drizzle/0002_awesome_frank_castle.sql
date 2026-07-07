ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_folder_id_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
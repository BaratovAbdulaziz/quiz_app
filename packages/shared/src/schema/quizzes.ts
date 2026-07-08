import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum } from "drizzle-orm/pg-core"
import { users } from "./users"
import { folders } from "./folders"
import { files } from "./files"

export const quizSourceEnum = pgEnum("quiz_source", ["uploaded_pdf", "ai_generated"])

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  source: quizSourceEnum("source").notNull().default("ai_generated"),
  sourceFileId: uuid("source_file_id").references(() => files.id, { onDelete: "set null" }),
  questionCount: integer("question_count").notNull().default(0),
  randomize: boolean("randomize").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

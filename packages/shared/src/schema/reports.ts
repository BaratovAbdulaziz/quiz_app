import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core"
import { users } from "./users"
import { questions } from "./questions"

export const reportReasonEnum = pgEnum("report_reason", ["incorrect_answer", "formatting", "typo", "other"])
export const reportStatusEnum = pgEnum("report_status", ["pending", "reviewed", "resolved"])

export const questionReports = pgTable("question_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  questionId: uuid("question_id").references(() => questions.id, { onDelete: "cascade" }).notNull(),
  reason: reportReasonEnum("reason").notNull(),
  comment: text("comment"),
  status: reportStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

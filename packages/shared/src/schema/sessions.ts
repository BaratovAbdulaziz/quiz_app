import { pgTable, text, timestamp, uuid, integer, pgEnum } from "drizzle-orm/pg-core"
import { quizzes } from "./quizzes"
import { users } from "./users"
import { questions } from "./questions"

export const sessionModeEnum = pgEnum("session_mode", ["practice", "exam"])
export const sessionStatusEnum = pgEnum("session_status", ["in_progress", "completed"])

export const quizSessions = pgTable("quiz_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id").references(() => quizzes.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  mode: sessionModeEnum("mode").notNull(),
  status: sessionStatusEnum("status").notNull().default("in_progress"),
  score: integer("score"),
  total: integer("total"),
  skippedCount: integer("skipped_count").default(0),
  timeSeconds: integer("time_seconds"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const questionResponses = pgTable("question_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => quizSessions.id, { onDelete: "cascade" }).notNull(),
  questionId: uuid("question_id").references(() => questions.id, { onDelete: "cascade" }).notNull(),
  selectedIndex: integer("selected_index"),
  isCorrect: integer("is_correct"),
  isSkipped: integer("is_skipped").notNull().default(0),
  answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
})

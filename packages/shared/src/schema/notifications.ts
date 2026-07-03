import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core"
import { users } from "./users"

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("quiz_ready"),
  sent: boolean("sent").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

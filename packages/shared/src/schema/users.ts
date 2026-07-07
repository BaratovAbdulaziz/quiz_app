import { pgTable, bigint, text, timestamp, uuid, integer } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").unique(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique(),
  telegramUsername: text("telegram_username"),
  email: text("email"),
  authProvider: text("auth_provider").notNull().default("telegram"),
  username: text("username").unique(),
  displayName: text("display_name").notNull(),
  photoUrl: text("photo_url"),
  languageCode: text("language_code").default("en"),
  credits: integer("credits").notNull().default(100),
  creditsRefreshAt: timestamp("credits_refresh_at", { withTimezone: true }).notNull().defaultNow(),
  isTestUser: integer("is_test_user").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

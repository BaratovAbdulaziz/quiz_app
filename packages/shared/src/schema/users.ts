import { pgTable, bigint, text, timestamp, uuid, integer } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  telegramUsername: text("telegram_username"),
  displayName: text("display_name").notNull(),
  photoUrl: text("photo_url"),
  languageCode: text("language_code").default("en"),
  credits: integer("credits").notNull().default(100),
  creditsRefreshAt: timestamp("credits_refresh_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

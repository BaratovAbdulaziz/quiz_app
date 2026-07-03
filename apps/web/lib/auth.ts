import jwt from "jsonwebtoken"
import crypto from "crypto"
import { eq } from "drizzle-orm"
import { db } from "./db"
import { users } from "@quiz-app/shared"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production"
const ACCESS_TOKEN_EXPIRY = "15m"
const REFRESH_TOKEN_EXPIRY = "30d"

export interface AuthPayload {
  userId: string
  telegramId: number
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY })
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return null
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function verifyTelegramInitData(initData: string): Promise<{
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
} | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null

  params.delete("hash")
  const keys = Array.from(params.keys()).sort()
  const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join("\n")

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest()
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  if (computedHash !== hash) return null

  const authDate = parseInt(params.get("auth_date") || "0", 10)
  if (Date.now() / 1000 - authDate > 86400) return null

  try {
    return JSON.parse(params.get("user") || "{}")
  } catch {
    return null
  }
}

export async function upsertUser(tgUser: {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}) {
  const existing = await db.select().from(users).where(eq(users.telegramId, tgUser.id)).limit(1)

  if (existing.length > 0) {
    const u = existing[0]
    await db.update(users)
      .set({
        telegramUsername: tgUser.username || u.telegramUsername,
        displayName: tgUser.first_name || u.displayName,
        photoUrl: tgUser.photo_url || u.photoUrl,
        languageCode: tgUser.language_code || u.languageCode,
      })
      .where(eq(users.id, u.id))
    return u
  }

  const [created] = await db.insert(users).values({
    telegramId: tgUser.id,
    telegramUsername: tgUser.username || null,
    displayName: tgUser.first_name,
    photoUrl: tgUser.photo_url || null,
    languageCode: tgUser.language_code || "en",
    credits: 100,
    creditsRefreshAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  }).returning()

  return created
}

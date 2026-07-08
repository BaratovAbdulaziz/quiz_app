import { NextRequest, NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@quiz-app/shared"

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("password") !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }

    const all = await db.select({
      id: users.id,
      telegramId: users.telegramId,
      telegramUsername: users.telegramUsername,
      displayName: users.displayName,
      credits: users.credits,
      tokens: users.credits,
      isTestUser: users.isTestUser,
      createdAt: users.createdAt,
    }).from(users).where(sql`${users.isTestUser} = 0`).orderBy(users.createdAt)

    return NextResponse.json({ data: all })
  } catch (e: unknown) {
    const err = e as any
    const msg = err?.message || err?.code || (err?.errors?.[0]?.message) || "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { password, userId, credits } = await request.json()
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }

    if (!userId || typeof credits !== "number" || credits === 0) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "userId and non-zero credits amount required" } }, { status: 400 })
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 })
    }

    const updated = Math.max(0, user.credits + credits)
    await db.update(users).set({ credits: updated }).where(eq(users.id, userId))

    return NextResponse.json({ data: { credits: updated } })
  } catch (e: unknown) {
    const err = e as any
    const msg = err?.message || err?.code || (err?.errors?.[0]?.message) || "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const [user] = await db.select().from(users).where(eq(users.id, auth.user.userId)).limit(1)
  if (!user) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      username: user.username,
      displayName: user.displayName,
      language: user.languageCode || "en",
      credits: user.credits,
      creditsRefreshAt: user.creditsRefreshAt,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.displayName) updates.displayName = body.displayName
  if (body.language) updates.languageCode = body.language

  if (body.username !== undefined) {
    const username = body.username.trim().toLowerCase()
    if (!username) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "Username cannot be empty" } }, { status: 400 })
    }
    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "Username must be 3-20 characters, letters, numbers and underscores only" } }, { status: 400 })
    }
    const [existing] = await db.select({ id: users.id }).from(users)
      .where(sql`lower(${users.username}) = ${username}`)
      .limit(1)
    if (existing && existing.id !== auth.user.userId) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "Username is already taken" } }, { status: 409 })
    }
    updates.username = username
  }

  const [user] = await db.update(users)
    .set(updates)
    .where(eq(users.id, auth.user.userId))
    .returning()

  return NextResponse.json({
    data: {
      username: user.username,
      displayName: user.displayName,
      language: user.languageCode,
      credits: user.credits,
      creditsRefreshAt: user.creditsRefreshAt,
    },
  })
}

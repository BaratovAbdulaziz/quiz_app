import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const [user] = await db.select().from(users).where(eq(users.id, auth.user.userId)).limit(1)
  if (!user) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      displayName: user.displayName,
      language: user.languageCode || "en",
      credits: user.credits,
      creditsRefreshAt: user.creditsRefreshAt,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.displayName) updates.displayName = body.displayName
  if (body.language) updates.languageCode = body.language

  const [user] = await db.update(users)
    .set(updates)
    .where(eq(users.id, auth.user.userId))
    .returning()

  return NextResponse.json({
    data: {
      displayName: user.displayName,
      language: user.languageCode,
      credits: user.credits,
      creditsRefreshAt: user.creditsRefreshAt,
    },
  })
}

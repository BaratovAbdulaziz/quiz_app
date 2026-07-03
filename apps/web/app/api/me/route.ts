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
      id: user.id,
      telegramId: user.telegramId,
      username: user.telegramUsername,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode,
      credits: user.credits,
      creditsRefreshAt: user.creditsRefreshAt,
    },
  })
}

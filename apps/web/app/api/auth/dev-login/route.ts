import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { signAccessToken, signRefreshToken } from "@/lib/auth"

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Only available in development" } }, { status: 403 })
  }

  const userId = crypto.randomUUID()
  const testId = 999999999

  const payload = { userId, telegramId: testId }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  return NextResponse.json({
    data: {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        clerkId: null,
        telegramId: testId,
        email: null,
        authProvider: "dev",
        username: "dev_user",
        displayName: "Dev User",
        photoUrl: null,
        languageCode: "en",
        credits: 100,
        creditsRefreshAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  })
}

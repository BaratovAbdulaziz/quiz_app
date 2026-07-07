import { NextRequest, NextResponse } from "next/server"
import { verifyTelegramInitData, upsertUser, signAccessToken, signRefreshToken, hashToken } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json()
    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "initData is required" } }, { status: 400 })
    }

    const tgUser = await verifyTelegramInitData(initData)
    if (!tgUser) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired authentication" } }, { status: 401 })
    }

    const user = await upsertUser(tgUser)

    const payload = { userId: user.id, telegramId: user.telegramId! }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    const hashedRefresh = hashToken(refreshToken)

    return NextResponse.json({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          clerkId: user.clerkId,
          telegramId: user.telegramId,
          email: user.email,
          authProvider: user.authProvider,
          username: user.telegramUsername,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          languageCode: user.languageCode,
          credits: user.credits,
          creditsRefreshAt: user.creditsRefreshAt,
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Authentication failed" } }, { status: 500 })
  }
}

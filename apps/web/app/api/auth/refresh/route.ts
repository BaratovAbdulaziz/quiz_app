import { NextRequest, NextResponse } from "next/server"
import { verifyToken, signAccessToken, signRefreshToken, hashToken, AuthPayload } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json()
    if (!refreshToken || typeof refreshToken !== "string") {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Refresh token is required" } }, { status: 400 })
    }

    const payload = verifyToken(refreshToken) as AuthPayload | null
    if (!payload) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" } }, { status: 401 })
    }

    const newPayload = { userId: payload.userId, telegramId: payload.telegramId }
    const newAccessToken = signAccessToken(newPayload)
    const newRefreshToken = signRefreshToken(newPayload)

    return NextResponse.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    })
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Token refresh failed" } }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@quiz-app/shared"
import { signAccessToken, signRefreshToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { clerkToken } = await request.json()
    if (!clerkToken) {
      return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "clerkToken is required" } }, { status: 400 })
    }

    let clerkUserId: string
    try {
      const payload = JSON.parse(Buffer.from(clerkToken.split(".")[1], "base64").toString())
      clerkUserId = payload.sub
      if (!clerkUserId) throw new Error("No sub in token")
    } catch {
      return NextResponse.json({ error: { code: "INVALID_TOKEN", message: "Invalid Clerk token" } }, { status: 401 })
    }

    let client
    try {
      client = await clerkClient()
    } catch (e) {
      console.error("[auth/clerk] clerkClient() failed:", e)
      return NextResponse.json({ error: { code: "CLERK_CLIENT_ERROR", message: "Failed to initialize Clerk client" } }, { status: 500 })
    }

    let email: string | null = null
    let displayName = "User"
    let photoUrl: string | null = null

    try {
      const clerkUser = await client.users.getUser(clerkUserId)
      email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null
      displayName = clerkUser.fullName || clerkUser.firstName || clerkUser.username || displayName
      photoUrl = clerkUser.imageUrl ?? null
    } catch (e) {
      console.error("[auth/clerk] getUser failed, proceeding with JWT claims:", e)
      try {
        const payload = JSON.parse(Buffer.from(clerkToken.split(".")[1], "base64").toString())
        email = payload.email ?? null
        displayName = payload.name ?? payload.given_name ?? displayName
        photoUrl = payload.picture ?? null
      } catch {}
    }

    let existing
    try {
      [existing] = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1)
    } catch (e) {
      console.error("[auth/clerk] DB select failed:", e)
      return NextResponse.json({ error: { code: "DB_ERROR", message: "Database query failed" } }, { status: 500 })
    }

    let user
    if (existing) {
      const updates: Record<string, unknown> = {
        deletedAt: null,
      }
      if (email) updates.email = email
      if (displayName) updates.displayName = displayName
      if (photoUrl) updates.photoUrl = photoUrl
      try {
        await db.update(users).set(updates).where(eq(users.id, existing.id))
      } catch (e) {
        console.error("[auth/clerk] DB update failed:", e)
        return NextResponse.json({ error: { code: "DB_ERROR", message: "Database update failed" } }, { status: 500 })
      }
      user = { ...existing, ...updates }
    } else {
      try {
        const [created] = await db.insert(users).values({
          clerkId: clerkUserId,
          authProvider: "google",
          email,
          displayName,
          photoUrl,
          languageCode: "en",
          credits: 100,
          creditsRefreshAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        }).returning()
        user = created
      } catch (e) {
        console.error("[auth/clerk] DB insert failed:", e)
        return NextResponse.json({ error: { code: "DB_ERROR", message: "Database insert failed" } }, { status: 500 })
      }
    }

    let accessToken: string
    let refreshToken: string
    try {
      accessToken = signAccessToken({ userId: user.id })
      refreshToken = signRefreshToken({ userId: user.id })
    } catch (e) {
      console.error("[auth/clerk] JWT signing failed:", e)
      return NextResponse.json({ error: { code: "JWT_ERROR", message: "Token signing failed" } }, { status: 500 })
    }

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
          username: user.username,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          languageCode: user.languageCode,
          credits: user.credits,
          creditsRefreshAt: user.creditsRefreshAt,
        },
      },
    })
  } catch (error) {
    console.error("[auth/clerk] unexpected error:", error)
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Authentication failed" } }, { status: 500 })
  }
}

import { auth as clerkAuth, clerkClient } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { verifyToken } from "../lib/auth"
import { db } from "../lib/db"
import { users } from "@quiz-app/shared"

async function resolveClerkUser(sessionUserId: string, sessionClaims?: Record<string, unknown>): Promise<{ userId: string } | null> {
  const [existing] = await db.select().from(users).where(eq(users.clerkId, sessionUserId)).limit(1)
  if (existing) {
    if (existing.deletedAt) {
      await db.update(users).set({ deletedAt: null }).where(eq(users.id, existing.id))
    }
    return { userId: existing.id }
  }

  let email: string | null = null
  let displayName = "User"
  let photoUrl: string | null = null

  try {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(sessionUserId)
    email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null
    displayName = clerkUser.fullName || clerkUser.firstName || clerkUser.username || displayName
    photoUrl = clerkUser.imageUrl ?? null
  } catch {
    if (sessionClaims) {
      email = (sessionClaims.email as string) ?? null
      displayName = (sessionClaims.name as string) ?? (sessionClaims.given_name as string) ?? displayName
      photoUrl = (sessionClaims.picture as string) ?? null
    }
  }

  try {
    const [created] = await db.insert(users).values({
      clerkId: sessionUserId,
      authProvider: "google",
      email,
      displayName,
      photoUrl,
      languageCode: "en",
      credits: 100,
      creditsRefreshAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    }).returning()

    return { userId: created.id }
  } catch {
    return null
  }
}

export async function getAuthUser(request: NextRequest): Promise<{ userId: string } | null> {
  const header = request.headers.get("authorization")
  if (header?.startsWith("Bearer ")) {
    const payload = verifyToken(header.slice(7))
    if (payload) return { userId: payload.userId }
  }

  try {
    const session = await clerkAuth()
    if (session?.userId) {
      const result = await resolveClerkUser(session.userId, session.sessionClaims as Record<string, unknown> | undefined)
      if (result) return result
    }
  } catch {}

  return null
}

export async function withAuth(request: NextRequest): Promise<{ user: { userId: string } } | NextResponse> {
  const header = request.headers.get("authorization")
  if (header?.startsWith("Bearer ")) {
    const payload = verifyToken(header.slice(7))
    if (payload) return { user: { userId: payload.userId } }
  }

  try {
    const session = await clerkAuth()
    if (session?.userId) {
      const result = await resolveClerkUser(session.userId, session.sessionClaims as Record<string, unknown> | undefined)
      if (result) return { user: result }
    }
  } catch {}

  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 })
}

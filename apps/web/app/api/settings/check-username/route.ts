import { NextRequest, NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { username } = await request.json()
  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json({ available: false, message: "Invalid username" }, { status: 400 })
  }

  const val = username.trim().toLowerCase()

  const [existing] = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.username}) = ${val}`)
    .limit(1)

  if (existing && existing.id !== auth.user.userId) {
    return NextResponse.json({ available: false, message: "Username is already taken" })
  }

  return NextResponse.json({ available: true })
}

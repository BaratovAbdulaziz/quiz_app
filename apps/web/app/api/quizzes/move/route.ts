import { NextRequest, NextResponse } from "next/server"
import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { ids, folderId } = await request.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Quiz IDs required" } }, { status: 400 })
  }

  await db.update(quizzes)
    .set({ folderId: folderId || null, updatedAt: new Date() })
    .where(and(eq(quizzes.userId, auth.user.userId), inArray(quizzes.id, ids)))

  return NextResponse.json({ data: { success: true } })
}

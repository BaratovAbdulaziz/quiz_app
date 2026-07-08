import { NextRequest, NextResponse } from "next/server"
import { eq, desc, and, inArray, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const result = await db.select()
      .from(quizzes)
      .where(and(eq(quizzes.userId, auth.user.userId), isNotNull(quizzes.deletedAt)))
      .orderBy(desc(quizzes.deletedAt))

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { ids, action } = await request.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Quiz IDs required" } }, { status: 400 })
  }

  if (action === "restore") {
    await db.update(quizzes)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(quizzes.userId, auth.user.userId), inArray(quizzes.id, ids)))
    return NextResponse.json({ data: { success: true } })
  }

  if (action === "delete") {
    await db.delete(quizzes).where(and(eq(quizzes.userId, auth.user.userId), inArray(quizzes.id, ids)))
    return NextResponse.json({ data: { success: true } })
  }

  return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Unknown action" } }, { status: 400 })
}
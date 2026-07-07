import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes, quizSessions, questionResponses } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, auth.user.userId))).limit(1)
  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  const existingSessions = await db.select().from(quizSessions)
    .where(and(eq(quizSessions.quizId, id), eq(quizSessions.userId, auth.user.userId), eq(quizSessions.status, "in_progress")))

  for (const s of existingSessions) {
    await db.delete(questionResponses).where(eq(questionResponses.sessionId, s.id))
    await db.delete(quizSessions).where(eq(quizSessions.id, s.id))
  }

  return NextResponse.json({ data: { success: true } })
}

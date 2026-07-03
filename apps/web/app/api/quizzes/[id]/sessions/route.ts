import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes, quizSessions, questions } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json()
  const mode = body.mode || "practice"

  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, auth.user.userId))).limit(1)
  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  const [session] = await db.insert(quizSessions).values({
    quizId: id,
    userId: auth.user.userId,
    mode,
    status: "in_progress",
    total: quiz.questionCount,
  }).returning()

  const qs = await db.select().from(questions).where(eq(questions.quizId, id)).orderBy(questions.order)

  return NextResponse.json({ data: { session, questions: qs } }, { status: 201 })
}

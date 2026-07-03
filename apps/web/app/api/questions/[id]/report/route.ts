import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { questions, quizzes, questionReports } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { reason, comment } = await request.json()

  const [question] = await db.select().from(questions).where(eq(questions.id, id)).limit(1)
  if (!question) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Question not found" } }, { status: 404 })
  }

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, question.quizId)).limit(1)
  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  const [report] = await db.insert(questionReports).values({
    reporterId: auth.user.userId,
    ownerId: quiz.userId,
    questionId: id,
    reason: reason || "other",
    comment: comment || null,
  }).returning()

  return NextResponse.json({ data: { report } }, { status: 201 })
}

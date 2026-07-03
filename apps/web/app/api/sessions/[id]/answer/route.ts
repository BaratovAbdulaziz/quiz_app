import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizSessions, questionResponses, questions } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { questionId, selectedIndex } = await request.json()

  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, id)).limit(1)
  if (!session || session.userId !== auth.user.userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 })
  }

  const [question] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1)
  if (!question) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Question not found" } }, { status: 404 })
  }

  const isCorrect = selectedIndex === question.correctIndex ? 1 : 0

  const [response] = await db.insert(questionResponses).values({
    sessionId: id,
    questionId,
    selectedIndex,
    isCorrect,
    isSkipped: 0,
  }).returning()

  return NextResponse.json({
    data: {
      response,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    },
  }, { status: 201 })
}

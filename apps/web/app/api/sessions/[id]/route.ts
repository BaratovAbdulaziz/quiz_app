import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizSessions, questionResponses, questions } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, id)).limit(1)
  if (!session || session.userId !== auth.user.userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 })
  }

  const responses = await db.select().from(questionResponses).where(eq(questionResponses.sessionId, id))

  const qs = await db.select().from(questions).where(eq(questions.quizId, session.quizId)).orderBy(questions.order)

  return NextResponse.json({
    data: {
      session,
      responses,
      questions: qs,
    },
  })
}

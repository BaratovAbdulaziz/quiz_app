import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { shareLinks, quizzes, questions, users } from "@quiz-app/shared"

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
  if (!link || !link.active) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Share link not found or expired" } }, { status: 404 })
  }

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, link.quizId)).limit(1)
  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  const [owner] = await db.select().from(users).where(eq(users.id, quiz.userId)).limit(1)

  const qs = await db.select().from(questions).where(eq(questions.quizId, quiz.id)).orderBy(questions.order)

  return NextResponse.json({
    data: {
      token: link.token,
      quiz: {
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questionCount,
        questions: qs.map(q => ({
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      },
      owner: owner ? { displayName: owner.displayName } : null,
    },
  })
}

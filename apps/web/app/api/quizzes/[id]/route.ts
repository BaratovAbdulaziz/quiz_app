import { NextRequest, NextResponse } from "next/server"
import { eq, and, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes, questions } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, auth.user.userId))).limit(1)
  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  const qs = await db.select().from(questions).where(eq(questions.quizId, id)).orderBy(asc(questions.order))

  return NextResponse.json({ data: { ...quiz, questions: qs } })
}

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { shareLinks, quizzes, questions } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { token } = await params

  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1)
  if (!link || !link.active) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Share link not found or expired" } }, { status: 404 })
  }

  const [original] = await db.select().from(quizzes).where(eq(quizzes.id, link.quizId)).limit(1)
  if (!original) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Original quiz not found" } }, { status: 404 })
  }

  const qs = await db.select().from(questions).where(eq(questions.quizId, original.id)).orderBy(questions.order)

  const [importedQuiz] = await db.insert(quizzes).values({
    userId: auth.user.userId,
    title: `${original.title} (imported)`,
    description: original.description,
    source: original.source,
    questionCount: original.questionCount,
  }).returning()

  for (const q of qs) {
    await db.insert(questions).values({
      quizId: importedQuiz.id,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      order: q.order,
    })
  }

  return NextResponse.json({ data: { quiz: importedQuiz } }, { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizSessions, questionResponses } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { timeSeconds } = await request.json()

  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, id)).limit(1)
  if (!session || session.userId !== auth.user.userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 })
  }

  const responses = await db.select().from(questionResponses).where(eq(questionResponses.sessionId, id))

  let correct = 0
  let skippedCount = 0
  for (const r of responses) {
    if (r.isSkipped) skippedCount++
    else if (r.isCorrect) correct++
  }

  const [updated] = await db.update(quizSessions)
    .set({
      status: "completed",
      score: correct,
      skippedCount,
      timeSeconds: timeSeconds || null,
      completedAt: new Date(),
    })
    .where(eq(quizSessions.id, id))
    .returning()

  return NextResponse.json({ data: { session: updated, responses } })
}

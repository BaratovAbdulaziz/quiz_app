import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizSessions, questionResponses } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { questionId } = await request.json()

  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, id)).limit(1)
  if (!session || session.userId !== auth.user.userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 })
  }

  const [response] = await db.insert(questionResponses).values({
    sessionId: id,
    questionId,
    isSkipped: 1,
  }).returning()

  return NextResponse.json({ data: { response } }, { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, quizzes, folders, questions, quizSessions, questionResponses, questionReports, shareLinks, files, notifications } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function DELETE(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.user.userId

  const userQuizzes = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.userId, userId))
  for (const q of userQuizzes) {
    await db.delete(questionResponses).where(eq(questionResponses.sessionId, q.id))
  }
  await db.delete(quizSessions).where(eq(quizSessions.userId, userId))
  for (const q of userQuizzes) {
    await db.delete(questions).where(eq(questions.quizId, q.id))
  }
  await db.delete(shareLinks).where(eq(shareLinks.createdBy, userId))
  await db.delete(questionReports).where(eq(questionReports.ownerId, userId))
  await db.delete(quizzes).where(eq(quizzes.userId, userId))
  await db.delete(folders).where(eq(folders.userId, userId))
  await db.delete(files).where(eq(files.userId, userId))
  await db.delete(notifications).where(eq(notifications.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  return NextResponse.json({ data: { success: true } })
}

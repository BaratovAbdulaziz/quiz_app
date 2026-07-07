import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, quizzes, folders, questions, quizSessions, questionReports, shareLinks, files, notifications } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.user.userId

  try {
    await db.delete(quizSessions).where(eq(quizSessions.userId, userId))
    const userQuizIds = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.userId, userId))
    for (const q of userQuizIds) {
      await db.delete(questions).where(eq(questions.quizId, q.id))
    }
    await db.delete(shareLinks).where(eq(shareLinks.createdBy, userId))
    await db.delete(questionReports).where(eq(questionReports.ownerId, userId))
    await db.delete(quizzes).where(eq(quizzes.userId, userId))
    await db.delete(folders).where(eq(folders.userId, userId))
    await db.delete(files).where(eq(files.userId, userId))
    await db.delete(notifications).where(eq(notifications.userId, userId))

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId))

    return NextResponse.json({ data: { success: true } })
  } catch (e) {
    console.error("[account] delete failed:", e)
    return NextResponse.json({ error: { code: "DELETE_FAILED", message: "Failed to delete account" } }, { status: 500 })
  }
}

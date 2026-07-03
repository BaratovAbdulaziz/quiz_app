import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes, shareLinks } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"
import { nanoid } from "nanoid"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, auth.user.userId))).limit(1)
  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  const [link] = await db.insert(shareLinks).values({
    quizId: id,
    createdBy: auth.user.userId,
    token: nanoid(12),
  }).returning()

  const shareUrl = `${process.env.APP_URL || "http://localhost:3000"}/shared/${link.token}`

  return NextResponse.json({ data: { token: link.token, url: shareUrl } }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  await db.update(shareLinks)
    .set({ active: false })
    .where(and(eq(shareLinks.quizId, id), eq(shareLinks.createdBy, auth.user.userId)))

  return NextResponse.json({ data: { success: true } })
}

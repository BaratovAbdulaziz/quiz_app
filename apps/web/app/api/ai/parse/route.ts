import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { files, quizzes, questions, notifications, users } from "@quiz-app/shared"
import { parsePdfQuestions } from "@/lib/openrouter"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { fileId, title } = await request.json()

    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1)
    if (!file || file.userId !== auth.user.userId) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "File not found" } }, { status: 404 })
    }

    const [user] = await db.select().from(users).where(eq(users.id, auth.user.userId)).limit(1)
    if (!user || user.credits < 5) {
      return NextResponse.json({ error: { code: "INSUFFICIENT_CREDITS", message: "Insufficient AI credits" } }, { status: 403 })
    }

    const result = await parsePdfQuestions("PDF text extraction - placeholder")

    const [quiz] = await db.insert(quizzes).values({
      userId: auth.user.userId,
      title: title || file.originalName.replace(/\.pdf$/i, ""),
      description: `Parsed from ${file.originalName}`,
      source: "uploaded_pdf",
      sourceFileId: fileId,
      questionCount: result.questions.length,
    }).returning()

    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i]
      await db.insert(questions).values({
        quizId: quiz.id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || null,
        order: i,
      })
    }

    await db.update(users).set({ credits: user.credits - 5 }).where(eq(users.id, auth.user.userId))

    await db.insert(notifications).values({
      userId: auth.user.userId,
      message: `Your quiz "${quiz.title}" is ready. Open in app.`,
      type: "quiz_ready",
    })

    return NextResponse.json({ data: { quiz } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: {
        code: "PARSE_FAILED",
        message: error instanceof Error ? error.message : "Failed to parse PDF",
      },
    }, { status: 500 })
  }
}

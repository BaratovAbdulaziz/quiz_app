import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes, questions, users } from "@quiz-app/shared"
import { generateQuizQuestions, generateWithClarification } from "@/lib/openrouter"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { topic, clarificationAnswer, folderId } = await request.json()

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Topic is required" } }, { status: 400 })
    }

    const [user] = await db.select().from(users).where(eq(users.id, auth.user.userId)).limit(1)
    if (!user || user.credits < 3) {
      return NextResponse.json({ error: { code: "INSUFFICIENT_CREDITS", message: "Insufficient AI credits" } }, { status: 403 })
    }

    let result: { questions: Array<{ text: string; options: string[]; correctIndex: number; explanation?: string }>; clarificationNeeded?: string }

    if (clarificationAnswer) {
      result = await generateWithClarification(topic, clarificationAnswer)
    } else {
      result = await generateQuizQuestions(topic)
    }

    if (result.clarificationNeeded) {
      return NextResponse.json({
        data: { clarificationNeeded: result.clarificationNeeded },
      })
    }

    if (!result.questions || result.questions.length === 0) {
      return NextResponse.json({ error: { code: "NO_QUESTIONS", message: "No questions could be generated" } }, { status: 422 })
    }

    const [quiz] = await db.insert(quizzes).values({
      userId: auth.user.userId,
      title: topic.trim(),
      description: `AI-generated quiz about ${topic}`,
      source: "ai_generated",
      folderId: folderId || null,
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

    await db.update(users).set({ credits: user.credits - 3 }).where(eq(users.id, auth.user.userId))

    return NextResponse.json({ data: { quiz } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: {
        code: "GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to generate quiz",
      },
    }, { status: 500 })
  }
}

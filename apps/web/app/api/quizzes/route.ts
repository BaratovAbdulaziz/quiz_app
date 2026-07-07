import { NextRequest, NextResponse } from "next/server"
import { eq, desc, and, ilike, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { quizzes, questions } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folderId")
    const search = searchParams.get("search")

    let conditions = [eq(quizzes.userId, auth.user.userId)]

    if (folderId) {
      conditions.push(eq(quizzes.folderId, folderId))
    }

    if (search) {
      conditions.push(ilike(quizzes.title, `%${search}%`))
    }

    const result = await db.select()
      .from(quizzes)
      .where(and(...conditions))
      .orderBy(desc(quizzes.createdAt))

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const [quiz] = await db.insert(quizzes).values({
    userId: auth.user.userId,
    title: body.title,
    description: body.description || null,
    source: "ai_generated",
    folderId: body.folderId || null,
    questionCount: 0,
  }).returning()

  return NextResponse.json({ data: quiz }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { id, ...updates } = body

  const [quiz] = await db.update(quizzes)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, auth.user.userId)))
    .returning()

  if (!quiz) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Quiz not found" } }, { status: 404 })
  }

  return NextResponse.json({ data: quiz })
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const idsParam = searchParams.get("ids")

  if (!id && !idsParam) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Quiz ID or IDs required" } }, { status: 400 })
  }

  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean)
    await db.delete(quizzes).where(and(eq(quizzes.userId, auth.user.userId), inArray(quizzes.id, ids)))
    return NextResponse.json({ data: { success: true } })
  }

  await db.delete(quizzes).where(and(eq(quizzes.id, id!), eq(quizzes.userId, auth.user.userId)))
  return NextResponse.json({ data: { success: true } })
}

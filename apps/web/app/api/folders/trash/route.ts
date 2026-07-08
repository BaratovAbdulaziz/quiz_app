import { NextRequest, NextResponse } from "next/server"
import { eq, desc, and, inArray, isNotNull, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { folders, quizzes } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const result = await db.select()
      .from(folders)
      .where(and(eq(folders.userId, auth.user.userId), isNotNull(folders.deletedAt)))
      .orderBy(desc(folders.deletedAt))

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { ids, action } = await request.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Folder IDs required" } }, { status: 400 })
  }

  const userId = auth.user.userId

  if (action === "restore") {
    await db.update(folders)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(folders.userId, userId), inArray(folders.id, ids)))
    await db.update(quizzes)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(quizzes.userId, userId), inArray(quizzes.folderId, ids), isNotNull(quizzes.deletedAt)))
    return NextResponse.json({ data: { success: true } })
  }

  if (action === "delete") {
    await db.delete(folders).where(and(eq(folders.userId, userId), inArray(folders.id, ids)))
    return NextResponse.json({ data: { success: true } })
  }

  return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Unknown action" } }, { status: 400 })
}
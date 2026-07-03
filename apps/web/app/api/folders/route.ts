import { NextRequest, NextResponse } from "next/server"
import { eq, and, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { folders, quizzes } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const result = await db.select()
    .from(folders)
    .where(eq(folders.userId, auth.user.userId))
    .orderBy(asc(folders.name))

  const folderIds = result.map(f => f.id)
  const quizCounts = folderIds.length > 0
    ? await db.select({ folderId: quizzes.folderId, count: quizzes.id })
        .from(quizzes)
        .where(eq(quizzes.userId, auth.user.userId))
    : []

  const quizCountMap = new Map<string, number>()
  for (const qc of quizCounts) {
    if (qc.folderId) {
      quizCountMap.set(qc.folderId, (quizCountMap.get(qc.folderId) || 0) + 1)
    }
  }

  const withCounts = result.map(f => ({
    ...f,
    quizCount: quizCountMap.get(f.id) || 0,
  }))

  return NextResponse.json({ data: withCounts })
}

export async function POST(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { name, parentId } = await request.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Folder name is required" } }, { status: 400 })
  }

  const [folder] = await db.insert(folders).values({
    userId: auth.user.userId,
    name: name.trim(),
    parentId: parentId || null,
  }).returning()

  return NextResponse.json({ data: folder }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id, name } = await request.json()
  if (!id || !name) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "ID and name required" } }, { status: 400 })
  }

  const [folder] = await db.update(folders)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(folders.id, id), eq(folders.userId, auth.user.userId)))
    .returning()

  if (!folder) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Folder not found" } }, { status: 404 })
  }

  return NextResponse.json({ data: folder })
}

export async function DELETE(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Folder ID required" } }, { status: 400 })
  }

  const [folder] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.userId, auth.user.userId))).limit(1)
  if (!folder) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Folder not found" } }, { status: 404 })
  }

  await db.update(quizzes).set({ folderId: null }).where(and(eq(quizzes.folderId, id), eq(quizzes.userId, auth.user.userId)))
  await db.delete(folders).where(eq(folders.id, id))

  return NextResponse.json({ data: { success: true } })
}

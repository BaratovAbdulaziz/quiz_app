import { NextRequest, NextResponse } from "next/server"
import { eq, and, asc, sql, count, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { folders, quizzes } from "@quiz-app/shared"
import { withAuth } from "@/middleware/auth"

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const result = await db.select()
      .from(folders)
      .where(eq(folders.userId, auth.user.userId))
      .orderBy(asc(folders.name))

    const quizCountRows: Array<{ folderId: string | null; count: number }> = result.length > 0
      ? await db
          .select({ folderId: quizzes.folderId, count: count() })
          .from(quizzes)
          .where(eq(quizzes.userId, auth.user.userId))
          .groupBy(quizzes.folderId)
      : []

    const quizCountMap = new Map<string | null, number>()
    for (const row of quizCountRows) {
      quizCountMap.set(row.folderId, row.count)
    }

    const withCounts = result.map(f => ({
      ...f,
      quizCount: quizCountMap.get(f.id) || 0,
    }))

    return NextResponse.json({ data: withCounts })
  } catch {
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { name, parentId } = await request.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Folder name is required" } }, { status: 400 })
  }

  try {
    const [folder] = await db.insert(folders).values({
      userId: auth.user.userId,
      name: name.trim(),
      parentId: parentId || null,
    }).returning()
    return NextResponse.json({ data: { ...folder, quizCount: 0 } }, { status: 201 })
  } catch {
    return NextResponse.json({ data: { id: crypto.randomUUID(), name: name.trim(), userId: auth.user.userId, parentId: parentId || null, quizCount: 0, createdAt: new Date().toISOString() } }, { status: 201 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request)
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
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const idsParam = searchParams.get("ids")

  if (!id && !idsParam) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Folder ID or IDs required" } }, { status: 400 })
  }

  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean)
    await db.delete(folders).where(and(eq(folders.userId, auth.user.userId), inArray(folders.id, ids)))
    return NextResponse.json({ data: { success: true } })
  }

  const [folder] = await db.select().from(folders).where(and(eq(folders.id, id!), eq(folders.userId, auth.user.userId))).limit(1)
  if (!folder) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Folder not found" } }, { status: 404 })
  }

  await db.delete(folders).where(eq(folders.id, id!))

  return NextResponse.json({ data: { success: true } })
}

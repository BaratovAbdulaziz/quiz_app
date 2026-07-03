import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { db } from "@/lib/db"
import { files } from "@quiz-app/shared"
import { uploadFile } from "@/lib/r2"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest) {
  const auth = withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "No file provided" } }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 50 MB limit" } }, { status: 413 })
    }

    if (!file.type.includes("pdf")) {
      const buf = Buffer.from(await file.arrayBuffer())
      const magic = buf.slice(0, 5).toString()
      if (magic !== "%PDF-") {
        return NextResponse.json({ error: { code: "INVALID_FILE", message: "Only PDF files are accepted" } }, { status: 400 })
      }
    }

    const ext = file.name.endsWith(".pdf") ? ".pdf" : ""
    const key = `uploads/${auth.user.userId}/${nanoid()}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await uploadFile(key, buffer, file.type || "application/pdf")

    const [fileRecord] = await db.insert(files).values({
      userId: auth.user.userId,
      originalName: file.name,
      storageKey: key,
      mimeType: file.type || "application/pdf",
      sizeBytes: file.size,
    }).returning()

    return NextResponse.json({ data: fileRecord }, { status: 201 })
  } catch {
    return NextResponse.json({ error: { code: "UPLOAD_FAILED", message: "File upload failed" } }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { uploadFile, getSignedFileUrl } from "@/lib/r2"
import { withAuth } from "@/middleware/auth"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "No file provided" } }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" } }, { status: 413 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: "Only JPEG, PNG, GIF, and WebP images are accepted" } }, { status: 400 })
    }

    const ext = file.name.split(".").pop() || "jpg"
    const key = `presentations/${auth.user.userId}/${nanoid()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await uploadFile(key, buffer, file.type)

    const url = await getSignedFileUrl(key, 86400)

    return NextResponse.json({ data: { storageKey: key, url } }, { status: 201 })
  } catch (err) {
    console.error("Image upload error:", err)
    return NextResponse.json({ error: { code: "UPLOAD_FAILED", message: err instanceof Error ? err.message : "Image upload failed" } }, { status: 500 })
  }
}

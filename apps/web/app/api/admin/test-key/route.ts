import { NextRequest, NextResponse } from "next/server"

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""

export async function POST(request: NextRequest) {
  try {
    const { password, key } = await request.json()
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid password" } }, { status: 401 })
    }
    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "API key is required" } }, { status: 400 })
    }

    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "QuizApp/1.0" },
    })

    if (res.status === 200) {
      const data = await res.json()
      return NextResponse.json({
        data: {
          valid: true,
          credits: data.data?.credits ?? null,
          label: data.data?.label ?? null,
          usage: data.data?.usage ?? null,
          limit: data.data?.limit ?? null,
          isFreeKey: data.data?.is_free_key ?? false,
        },
      })
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ data: { valid: false, error: "Invalid or revoked key" } })
    }

    if (res.status === 429) {
      return NextResponse.json({ data: { valid: true, error: "Rate limited" } })
    }

    const text = await res.text().catch(() => "")
    return NextResponse.json({ data: { valid: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}

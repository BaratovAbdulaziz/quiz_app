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

    const authRes = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "QuizApp/1.0" },
    })

    if (authRes.status === 401 || authRes.status === 403) {
      return NextResponse.json({ data: { valid: false, error: "Invalid or revoked key" } })
    }

    if (authRes.status === 429) {
      return NextResponse.json({ data: { valid: true, error: "Rate limited", rateLimited: true } })
    }

    const authData = authRes.status === 200 ? await authRes.json().catch(() => ({})) : {}
    const keyInfo = authData.data || {}

    let canGenerate = false
    let generateError = ""
    let aiResponse = ""
    try {
      const genRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-nano-30b-a3b:free",
          messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
          max_tokens: 20,
        }),
      })
      if (genRes.ok) {
        canGenerate = true
        const genData = await genRes.json().catch(() => ({}))
        aiResponse = genData?.choices?.[0]?.message?.content || ""
      } else {
        const errBody = await genRes.json().catch(() => ({}))
        generateError = errBody?.error?.message || `HTTP ${genRes.status}`
      }
    } catch (e: unknown) {
      generateError = e instanceof Error ? e.message : "Network error"
    }

    return NextResponse.json({
      data: {
        valid: authRes.ok,
        canGenerate,
        generateError,
        aiResponse,
        label: keyInfo.label || "",
        usage: keyInfo.usage ?? 0,
        usage_monthly: keyInfo.usage_monthly ?? 0,
        is_free_tier: keyInfo.is_free_tier ?? true,
        limit: keyInfo.limit,
        limit_remaining: keyInfo.limit_remaining,
        key,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 })
  }
}

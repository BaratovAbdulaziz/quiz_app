import { NextRequest, NextResponse } from "next/server"
import { callOpenRouter } from "@/lib/openrouter"

export async function POST(request: NextRequest) {
  try {
    const { message, telegram_id } = await request.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Message is required" } }, { status: 400 })
    }

    const result = await callOpenRouter({
      prompt: `The user sent this message to the quiz app bot: "${message}". Respond helpfully and concisely. If they ask to generate quiz questions, ask for a specific topic. Keep responses under 200 characters.`,
      temperature: 0.7,
      maxTokens: 300,
    })

    return NextResponse.json({ data: { reply: result.content } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: { code: "BOT_ERROR", message: msg } }, { status: 500 })
  }
}

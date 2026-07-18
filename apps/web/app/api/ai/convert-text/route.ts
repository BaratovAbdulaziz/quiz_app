import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { text, language } = await request.json()

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Text content is required" } }, { status: 400 })
    }

    const lang = language || "en"
    const langMap: Record<string, string> = { en: "English", uz: "Uzbek", ru: "Russian" }
    const langName = langMap[lang] || "English"

    const prompt = `Convert the following text into presentation slides. Return ONLY valid JSON, no markdown code fences.

Return a JSON object with this exact structure:
{
  "title": "Presentation Title",
  "description": "Brief description",
  "slides": [
    {
      "title": "Slide Title",
      "content": ["bullet point 1", "bullet point 2"],
      "layout": "layoutType",
      "speakerNotes": "Speaker notes for this slide"
    }
  ]
}

Available layouts: "title", "titleContent", "sectionDivider", "twoColumn", "stats", "quote", "imageText", "timeline", "comparison", "numberedSteps", "closing"

Rules:
- First slide must use "title" layout
- Use "sectionDivider" for major topic transitions
- Use "stats" for data/metrics slides
- Use "quote" for testimonial/quote slides
- Use "twoColumn" for comparison content
- Use "timeline" for chronological content
- Use "comparison" for side-by-side comparisons
- Use "numberedSteps" for step-by-step processes
- Use "closing" for the final slide
- Include "speakerNotes" for every slide
- Each slide should have 2-5 bullet points
- Content in ${langName}
- Break long text into logical sections (10-15 slides ideal)
- Preserve all important information from the source text

Text to convert:
---
${text.slice(0, 15000)}
---`

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 8000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("AI convert-text error:", err)
      return NextResponse.json({ error: { code: "AI_ERROR", message: "AI conversion failed" } }, { status: 502 })
    }

    const result = await response.json()
    let content = result.choices?.[0]?.message?.content || ""

    // Strip markdown code fences
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()

    const parsed = JSON.parse(content)

    if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return NextResponse.json({ error: { code: "INVALID_RESPONSE", message: "AI returned invalid slide structure" } }, { status: 422 })
    }

    // Ensure all slides have required fields
    const slides = parsed.slides.map((s: any, i: number) => ({
      title: s.title || `Slide ${i + 1}`,
      content: Array.isArray(s.content) ? s.content : [],
      layout: s.layout || "titleContent",
      order: i,
      speakerNotes: s.speakerNotes || "",
    }))

    return NextResponse.json({
      data: {
        title: parsed.title || "Imported Presentation",
        description: parsed.description || "",
        slides,
      },
    })
  } catch (error) {
    console.error("convert-text error:", error)
    return NextResponse.json({
      error: {
        code: "CONVERSION_FAILED",
        message: error instanceof Error ? error.message : "Failed to convert text",
      },
    }, { status: 500 })
  }
}

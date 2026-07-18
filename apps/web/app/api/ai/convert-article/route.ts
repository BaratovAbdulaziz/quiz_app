import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/middleware/auth"

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { url, language } = await request.json()

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "URL is required" } }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim())
    } catch {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid URL" } }, { status: 400 })
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Only HTTP/HTTPS URLs are supported" } }, { status: 400 })
    }

    // Fetch the article
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; QuizFlow/1.0; +https://quizflow.app)",
        "Accept": "text/html,application/xhtml+xml,text/plain",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: { code: "FETCH_FAILED", message: `Failed to fetch URL (HTTP ${response.status})` } }, { status: 502 })
    }

    const contentType = response.headers.get("content-type") || ""
    const html = await response.text()

    // Extract text from HTML
    let articleText = ""
    if (contentType.includes("text/html")) {
      // Strip scripts, styles, nav, footer, etc.
      articleText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
    } else {
      articleText = html
    }

    if (!articleText || articleText.length < 50) {
      return NextResponse.json({ error: { code: "NO_CONTENT", message: "Could not extract meaningful content from URL" } }, { status: 422 })
    }

    const lang = language || "en"
    const langMap: Record<string, string> = { en: "English", uz: "Uzbek", ru: "Russian" }
    const langName = langMap[lang] || "English"

    const prompt = `Convert the following article into presentation slides. Return ONLY valid JSON, no markdown code fences.

Return a JSON object with this exact structure:
{
  "title": "Presentation Title (inferred from article)",
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
- Aim for 8-15 slides
- Preserve all key information from the article
- Summarize the article's main points, not every detail

Article content:
---
${articleText.slice(0, 20000)}
---`

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

    if (!aiResponse.ok) {
      const err = await aiResponse.text()
      console.error("AI convert-article error:", err)
      return NextResponse.json({ error: { code: "AI_ERROR", message: "AI conversion failed" } }, { status: 502 })
    }

    const result = await aiResponse.json()
    let content = result.choices?.[0]?.message?.content || ""

    // Strip markdown code fences
    content = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()

    const parsed = JSON.parse(content)

    if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return NextResponse.json({ error: { code: "INVALID_RESPONSE", message: "AI returned invalid slide structure" } }, { status: 422 })
    }

    const slides = parsed.slides.map((s: any, i: number) => ({
      title: s.title || `Slide ${i + 1}`,
      content: Array.isArray(s.content) ? s.content : [],
      layout: s.layout || "titleContent",
      order: i,
      speakerNotes: s.speakerNotes || "",
    }))

    return NextResponse.json({
      data: {
        title: parsed.title || "Article Presentation",
        description: parsed.description || `Based on: ${parsedUrl.hostname}`,
        slides,
      },
    })
  } catch (error) {
    console.error("convert-article error:", error)
    return NextResponse.json({
      error: {
        code: "CONVERSION_FAILED",
        message: error instanceof Error ? error.message : "Failed to process article",
      },
    }, { status: 500 })
  }
}

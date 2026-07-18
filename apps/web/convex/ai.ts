import { v } from "convex/values"
import { action } from "./_generated/server"

const DIFFICULTIES = ["easy", "medium", "hard"] as const
const LANGUAGES_MAP: Record<string, string> = { en: "English", uz: "Uzbek (O'zbek)", ru: "Russian (Русский)" }

const FREE_MODELS = [
  "qwen/qwen-2.5-7b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-3-4b-it:free",
  "mistralai/mistral-small-3.1-24b:free",
]

function extractJsonFromText(text: string): string | null {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/<antThinking>[\s\S]*?<\/antThinking>/g, "")
    .replace(/\n+/g, " ")
    .trim()

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]

  return null
}

async function callOpenRouter(
  prompt: string,
  keysEnv: string | undefined,
): Promise<string> {
  const keys = keysEnv
    ?.split(",")
    .map((k) => k.trim())
    .filter(Boolean) ?? []
  if (keys.length === 0) {
    console.error("[OpenRouter] No API keys configured. Set OPENROUTER_API_KEYS env var.")
    throw new Error("No API keys configured")
  }
  console.log(`[OpenRouter] Using ${keys.length} API key(s), ${FREE_MODELS.length} models`)

  const systemPrompt = `You are a JSON generation engine. Your ONLY output is valid JSON.
Rules:
- Output ONLY the JSON object, nothing else
- No explanations, no markdown, no code fences
- No thinking tags or reasoning
- No text before or after the JSON
- Ensure all strings are properly escaped
- Ensure all brackets and braces are balanced`

  let lastError = ""

  for (const model of FREE_MODELS) {
    for (const key of keys) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const msg = data.choices?.[0]?.message
          const raw = msg?.content || msg?.reasoning || ""
          const jsonStr = extractJsonFromText(raw)
          if (jsonStr) {
            console.log(`[OpenRouter] ${model}: Got valid JSON response`)
            return jsonStr
          }
          lastError = `Model ${model}: No valid JSON in response`
          console.warn(`[OpenRouter] ${model}: Response had no JSON. Raw (200 chars):`, raw.slice(0, 200))
        } else if (res.status === 429) {
          lastError = `Model ${model}: Rate limited, trying next...`
          console.warn(`[OpenRouter] ${model}: Rate limited (429)`)
          continue
        } else {
          const errText = await res.text()
          lastError = `Model ${model}: API error ${res.status}`
          console.warn(`[OpenRouter] ${model}: HTTP ${res.status} -`, errText.slice(0, 200))
        }
      } catch (e) {
        lastError = `Model ${model}: ${e instanceof Error ? e.message : "Network error"}`
      }
    }
  }

  throw new Error(`All AI models failed. Last error: ${lastError}`)
}

export const generateQuiz = action({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    description: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    questionCount: v.optional(v.float64()),
    difficulty: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const qCount = args.questionCount ?? 5
    const difficulty = args.difficulty ?? "medium"
    const language = args.language ?? "en"
    const langName = LANGUAGES_MAP[language] || "English"

    const prompt = `Generate a ${qCount}-question quiz JSON about "${args.topic}"${args.description ? ` (${args.description})` : ""} at ${difficulty} level in ${langName}.

Return ONLY this JSON format:
{"title":"Title","description":"Description","questions":[{"text":"Question","options":["A","B","C","D"],"correctIndex":0,"explanation":"Why"}]}

Rules:
- Exactly ${qCount} questions
- 4 options per question, one correct (correctIndex 0-3)
- All text in ${langName}

Example: {"title":"Planets","description":"Solar system quiz","questions":[{"text":"Largest planet?","options":["Mars","Earth","Jupiter","Saturn"],"correctIndex":2,"explanation":"Jupiter is largest."}]}`

    let parsed: any
    for (let attempt = 0; attempt < 3; attempt++) {
      const content = await callOpenRouter(prompt, process.env.OPENROUTER_API_KEYS)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error("AI response without JSON:", content.slice(0, 300))
        if (attempt < 2) continue
        throw new Error("Invalid AI response format")
      }
      try {
        parsed = JSON.parse(jsonMatch[0])
        if (parsed.questions?.length > 0) break
      } catch (e) {
        console.error("Failed to parse JSON:", jsonMatch[0].slice(0, 300))
        if (attempt < 2) continue
        throw new Error("Invalid JSON in AI response")
      }
    }

    const questions: Array<{
      text: string
      options: string[]
      correctIndex: number
      explanation?: string
      order: number
    }> = (parsed.questions ?? []).map((q: any, i: number) => ({
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      order: i,
    }))

    if (questions.length === 0) throw new Error("No questions generated")

    const quizId = await ctx.runMutation("quizzes:create", {
      userId: args.userId,
      folderId: args.folderId,
      title: parsed.title || args.topic,
      description: parsed.description || args.description || "",
      source: "ai_generated",
      questionCount: questions.length,
      difficulty,
      language,
      questions,
    })

    await ctx.runMutation("users:adjustCredits", {
      userId: args.userId,
      amount: -(qCount * 2),
    })

    return { quizId }
  },
})

function canPlaceCrossword(
  grid: string[][],
  word: string,
  startR: number,
  startC: number,
  dir: "across" | "down",
  size: number,
): boolean {
  if (dir === "across" && startC + word.length > size) return false
  if (dir === "down" && startR + word.length > size) return false

  let crossings = 0
  for (let j = 0; j < word.length; j++) {
    const r = dir === "across" ? startR : startR + j
    const c = dir === "across" ? startC + j : startC
    const cell = grid[r][c]
    if (cell === " ") continue
    if (cell !== word[j]) return false
    crossings++
  }
  if (crossings === 0) return false
  return true
}

function placeCrosswordGrid(words: Array<{ word: string; clue: string }>, size: number) {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(" "))
  const placed: Array<{ word: string; clue: string; row: number; col: number; direction: string; number: number; order: number }> = []

  const sorted = [...words]
  let nextNumber = 1

  const first = sorted[0]
  const startRow = Math.floor(size / 2)
  const startCol = Math.floor((size - first.word.length) / 2)
  for (let j = 0; j < first.word.length; j++) grid[startRow][startCol + j] = first.word[j]
  placed.push({ word: first.word, clue: first.clue, row: startRow, col: startCol, direction: "across", number: nextNumber++, order: 0 })

  let placedAny = true
  while (placedAny) {
    placedAny = false
    for (let wi = 1; wi < sorted.length; wi++) {
      if (placed.some((p) => p.word === sorted[wi].word)) continue
      const w = sorted[wi]

      let bestRow = -1, bestCol = -1, bestDir: "across" | "down" = "across", bestScore = -1

      for (const dir of ["across", "down"] as const) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (canPlaceCrossword(grid, w.word, r, c, dir, size)) {
              let score = 0
              for (let j = 0; j < w.word.length; j++) {
                const cr = dir === "across" ? r : r + j
                const cc = dir === "across" ? c + j : c
                if (grid[cr][cc] === w.word[j]) score++
              }
              if (score > bestScore) {
                bestScore = score
                bestRow = r
                bestCol = c
                bestDir = dir
              }
            }
          }
        }
      }

      if (bestRow === -1) continue

      for (let j = 0; j < w.word.length; j++) {
        if (bestDir === "across") grid[bestRow][bestCol + j] = w.word[j]
        else grid[bestRow + j][bestCol] = w.word[j]
      }
      placed.push({ word: w.word, clue: w.clue, row: bestRow, col: bestCol, direction: bestDir, number: nextNumber, order: wi })
      nextNumber++
      placedAny = true
    }
  }

  return placed
}

export const generateCrossword = action({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    description: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    difficulty: v.optional(v.string()),
    language: v.optional(v.string()),
    gridSize: v.optional(v.float64()),
    wordCount: v.optional(v.float64()),
  },
  handler: async (ctx: any, args: any) => {
    const difficulty = args.difficulty ?? "medium"
    const language = args.language ?? "en"
    const langName = LANGUAGES_MAP[language] || "English"
    const size = args.gridSize ?? 10
    const wordCount = Math.min(Math.max(args.wordCount ?? 8, 4), 20)

    const maxLetters = Math.min(8, size)

    const FALLBACK_WORDS: Record<string, Array<{ word: string; clue: string }>> = {
      default: [
        { word: "PUZZLE", clue: "A game or problem to solve" },
        { word: "BRAIN", clue: "Organ used for thinking" },
        { word: "LOGIC", clue: "Reasoning conducted carefully" },
        { word: "SMART", clue: "Intelligent or clever" },
        { word: "THINK", clue: "Use the mind to consider" },
        { word: "SOLVE", clue: "Find an answer to a problem" },
        { word: "IDEA", clue: "A thought or suggestion" },
        { word: "LEARN", clue: "Gain knowledge or skill" },
      ],
    }

    const prompt = `Generate exactly ${wordCount} words with clues about "${args.topic}"${args.description ? ` (${args.description})` : ""} in ${langName}.

Return ONLY this JSON array:
[{"word":"ANSWER","clue":"Clue text"}]

Rules:
- EXACTLY ${wordCount} words, 3-${maxLetters} letters each, ALL CAPS
- Use a mix of short (3-4 letters) and medium (5-${maxLetters} letters) words
- IMPORTANT: Choose words that share common letters (A, E, I, O, S, T, R, N, L) so they can interlock in a crossword grid
- Avoid words with rare letters (Q, X, Z, J) unless they share letters with other words
- Clues in ${langName}
- Words must be common, well-known words related to the topic

Example: [{"word":"CAT","clue":"Feline pet"},{"word":"DOG","clue":"Canine pet"},{"word":"COW","clue":"Farm animal that moos"}]`

    let clues: Array<{ word: string; clue: string; row: number; col: number; direction: string; number: number; order: number }> = []

    for (let aiAttempt = 0; aiAttempt < 3 && clues.length < wordCount; aiAttempt++) {
      let wordList: Array<{ word: string; clue: string }> = []
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`[Crossword] AI attempt ${attempt + 1}/3, topic="${args.topic}", wordCount=${wordCount}`)
          const content = await callOpenRouter(prompt, process.env.OPENROUTER_API_KEYS)
          console.log(`[Crossword] AI response (first 300 chars):`, content.slice(0, 300))
          const jsonMatch = content.match(/\[[\s\S]*\]/) || content.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            console.error("[Crossword] No JSON found in response:", content.slice(0, 500))
            continue
          }
          try {
            const parsed = JSON.parse(jsonMatch[0])
            const arr = Array.isArray(parsed) ? parsed : parsed.words || []
            wordList = arr
              .filter((w: any) => w.word && w.clue)
              .map((w: any) => ({ word: w.word.toUpperCase().replace(/[^A-Z]/g, ""), clue: w.clue }))
              .filter((w: any) => w.word.length >= 3 && w.word.length <= maxLetters)
            console.log(`[Crossword] Parsed ${wordList.length} valid words from AI:`, wordList.map((w) => w.word).join(", "))
            if (wordList.length >= 4) break
          } catch (e) {
            console.error("[Crossword] JSON parse error:", e, "Raw:", jsonMatch[0].slice(0, 300))
          }
        }
      } catch (e) {
        console.error("[Crossword] AI call failed:", e)
      }

      if (wordList.length < 4) {
        console.log("[Crossword] AI returned too few words, generating topic-specific fallback for:", args.topic)
        const fbPrompt = `Generate ${wordCount} short words (3-8 letters, ALL CAPS) with clues about "${args.topic}". Return ONLY a JSON array: [{"word":"ANSWER","clue":"Clue text"}]`
        try {
          const fbContent = await callOpenRouter(fbPrompt, process.env.OPENROUTER_API_KEYS)
          const fbJson = fbContent.match(/\[[\s\S]*\]/)
          if (fbJson) {
            const fbParsed = JSON.parse(fbJson[0])
            const fbArr = Array.isArray(fbParsed) ? fbParsed : []
            wordList = fbArr
              .filter((w: any) => w.word && w.clue)
              .map((w: any) => ({ word: w.word.toUpperCase().replace(/[^A-Z]/g, ""), clue: w.clue }))
              .filter((w: any) => w.word.length >= 3 && w.word.length <= maxLetters)
            console.log(`[Crossword] Fallback generated ${wordList.length} words:`, wordList.map((w) => w.word).join(", "))
          }
        } catch (e) {
          console.error("[Crossword] Fallback AI call also failed:", e)
        }
      }

      if (wordList.length < 4) {
        console.log("[Crossword] Using hardcoded fallback (no topic match)")
        wordList = FALLBACK_WORDS.default
          .filter((w) => w.word.length <= maxLetters)
          .slice(0, wordCount)
      }

      const crossable = wordList.filter((w) =>
        wordList.some((other) => other.word !== w.word && w.word.split("").some((ch) => other.word.includes(ch)))
      )
      if (crossable.length >= 4) wordList = crossable

      const result = placeCrosswordGrid(wordList, size)
      if (result.length > clues.length) clues = result

      if (clues.length < wordCount) {
        for (let i = 0; i < 5 && clues.length < wordCount; i++) {
          const shuffled = [...wordList].sort(() => Math.random() - 0.5)
          const shuffledResult = placeCrosswordGrid(shuffled, size)
          if (shuffledResult.length > clues.length) clues = shuffledResult
        }
      }
    }

    if (clues.length === 0) throw new Error("Could not place words in grid")

    const crosswordId = await ctx.runMutation("crosswords:create", {
      userId: args.userId,
      folderId: args.folderId,
      title: `${args.topic} Crossword`,
      description: args.description || `Crossword about ${args.topic}`,
      source: "ai_generated",
      difficulty,
      language,
      gridWidth: size,
      gridHeight: size,
      clues,
    })

    await ctx.runMutation("users:adjustCredits", {
      userId: args.userId,
      amount: -(clues.length * 2),
    })

    return { crosswordId }
  },
})

export const generatePresentation = action({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    description: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    language: v.optional(v.string()),
    theme: v.optional(v.string()),
    size: v.optional(v.string()),
    density: v.optional(v.string()),
    style: v.optional(v.string()),
    audience: v.optional(v.string()),
    slideCount: v.optional(v.float64()),
  },
  handler: async (ctx: any, args: any) => {
    const language = args.language ?? "en"
    const langName = LANGUAGES_MAP[language] || "English"
    const density = args.density ?? "standard"
    const style = args.style ?? "business"
    const audience = args.audience ?? "general"
    const slideCount = Math.min(Math.max(args.slideCount ?? 10, 5), 30)

    const densityGuide = density === "brief"
      ? `BRIEF — Concise, punchy slides. Prioritize bullet points. Target 15-25 words per content slide. Use 3-4 short bullets (under 6 words each). Avoid filler.`
      : density === "detailed"
      ? `DETAILED — Rich, informative slides. Provide deeper explanations and context. Target 60-90 words per content slide. Use 5-6 detailed bullets (up to 12 words each) or include short explanatory sentences.`
      : `STANDARD — Balanced text. Target 30-50 words per content slide. Use 3-5 clear bullets (under 10 words each).`

    const styleGuide: Record<string, string> = {
      academic: `ACADEMIC — Formal, research-oriented tone. Use precise terminology. Include data references and citations where appropriate. Structured like a scholarly presentation.`,
      business: `BUSINESS — Professional, persuasive tone. Focus on actionable insights, ROI, and key metrics. Executive-summary style with clear takeaways.`,
      creative: `CREATIVE — Engaging, storytelling-driven. Use metaphors, vivid language, and narrative arcs. Less corporate, more inspiration.`,
      minimal: `MINIMAL — Less is more. Ultra-clean slides with very short text. Let visuals speak. Maximum 2-3 bullets per slide, each under 5 words.`,
      bold: `BOLD — High-impact, attention-grabbing. Use strong statements, provocative questions, and power words. Designed to energize the audience.`,
      storytelling: `STORYTELLING — Build a narrative arc across slides. Use setup → conflict → resolution. Personal anecdotes, emotional hooks, and a clear journey.`,
    }

    const audienceGuide: Record<string, string> = {
      students: `Target audience: STUDENTS. Use accessible language, relatable examples, and educational framing. Keep explanations clear and engaging.`,
      executives: `Target audience: EXECUTIVES. Focus on strategic insights, bottom-line impact, and high-level summaries. No jargon without context.`,
      general: `Target audience: GENERAL AUDIENCE. Balanced, accessible language. Avoid niche jargon. Make it interesting for anyone.`,
      technical: `Target audience: TECHNICAL PROFESSIONALS. Can use domain-specific terminology. Focus on architecture, implementation, and technical depth.`,
      kids: `Target audience: CHILDREN (ages 8-12). Simple words, fun examples, emoji-friendly. Short sentences. Relatable to school life.`,
    }

    const prompt = `Create a ${langName} presentation about "${args.topic}"${args.description ? ` (${args.description})` : ""}.

STYLE: ${styleGuide[style] || styleGuide.business}
AUDIENCE: ${audienceGuide[audience] || audienceGuide.general}

Return JSON only:
{"title":"Title","description":"Desc","slides":[{"title":"Slide Title","content":["bullet1","bullet2"],"layout":"type","speakerNotes":"Speaker notes text"}]}

AVAILABLE LAYOUTS (use varied layouts across the presentation):
- "title" — Opening/closing slide. 1-2 items max (title + subtitle).
- "titleContent" — Title + bulleted content. 3-6 bullets.
- "twoColumn" — 2 items separated by \\n. Use for comparisons.
- "sectionDivider" — Section break. 1 short phrase. Bold colored background.
- "stats" — Data points. Items as "NUMBER|LABEL" format. 2-4 items.
- "quote" — 2 items: quote text + attribution/source.
- "timeline" — Chronological events. Items as "YEAR|Event description". 3-6 items.
- "comparison" — Pros/cons or before/after. 2 items: "Left Title|Item1\\nItem2" and "Right Title|Item1\\nItem2".
- "imageFocused" — Hero image with minimal caption text. Content: ["Caption text"].
- "numberedSteps" — Step-by-step process. Items: "Step 1: description". 3-6 steps.
- "closing" — Thank you/CTA slide. Items: ["Thank you message", "Contact or CTA"].
- "blank" — Empty slide for custom content.

CONTENT DENSITY:
${densityGuide}

SLIDE COUNT: Generate EXACTLY ${slideCount} slides total.

SLIDE-LEVEL RULES:
- Slide 1 MUST be "title" layout.
- Last slide MUST be "closing" layout.
- Include at least 1 "stats" slide and 1 "sectionDivider" slide.
- Use at least 5 different layout types across the presentation.
- Title slides: always minimal (2-4 words subtitle max), regardless of density setting.
- Section divider slides: always minimal (1 short phrase), regardless of density setting.
- Content slides: adjust detail level according to the density setting.
- Quote slides: 2 items (quote + attribution).
- Timeline slides: use "YEAR|Event" format consistently.
- Comparison slides: use "Title|Item1\\nItem2" format for each column.
- Numbered steps: use "Step N: description" format.
- Closing slides: brief and impactful.

SPEAKER NOTES:
- Include "speakerNotes" field for EVERY slide.
- Write talking points, not scripts. Bullet-point style.
- Provide context, examples, or transition phrases the speaker can use.
- Keep notes concise: 1-3 sentences per slide.

READABILITY RULES:
- Every bullet must fit on one line. Shorten long bullets.
- If content for a slide exceeds comfortable readability, SPLIT it into 2 slides.
- Prioritize clarity and scannability over completeness.
- Never shrink font or cram text.

DESIGN RULES:
- Density only affects text amount. Do NOT change layout, theme, fonts, or visual design.
- Use varied layouts — no more than 2 consecutive slides of the same layout type.
- Titles under 6 words.
- Start content arrays with uppercase letters.`


    let parsed: any
    for (let attempt = 0; attempt < 3; attempt++) {
      const content = await callOpenRouter(prompt, process.env.OPENROUTER_API_KEYS)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        if (attempt < 2) continue
        throw new Error("Invalid AI response format")
      }
      try {
        parsed = JSON.parse(jsonMatch[0])
        if (parsed.slides?.length > 0) break
      } catch (e) {
        if (attempt < 2) continue
        throw new Error("Invalid JSON in AI response")
      }
    }

    const validLayouts = ["title", "titleContent", "twoColumn", "sectionDivider", "stats", "quote", "timeline", "comparison", "imageFocused", "numberedSteps", "closing", "blank"]
    const slides: Array<{
      title: string
      content: string[]
      layout: string
      order: number
      speakerNotes?: string
    }> = (parsed.slides ?? []).map((s: any, i: number) => ({
      title: s.title || `Slide ${i + 1}`,
      content: Array.isArray(s.content) ? s.content : [],
      layout: validLayouts.includes(s.layout) ? s.layout : "titleContent",
      order: i,
      speakerNotes: s.speakerNotes || undefined,
    }))

    if (slides.length === 0) throw new Error("No slides generated")

    const presentationId = await ctx.runMutation("presentations:create", {
      userId: args.userId,
      folderId: args.folderId,
      title: parsed.title || args.topic,
      description: parsed.description || args.description || "",
      source: "ai_generated",
      language,
      theme: args.theme,
      size: args.size,
      density,
      style,
      audience,
      slideCount,
      slides,
    })

    // Generate images for slides that benefit from visuals
    const slidesNeedingImages = slides.filter((s: any) => !["stats", "quote", "timeline", "closing", "blank"].includes(s.layout))
    for (const slide of slidesNeedingImages) {
      try {
        const layoutPrompts: Record<string, string> = {
          title: "elegant title card background, abstract gradient, professional keynote opening slide, cinematic wide shot",
          sectionDivider: "bold section divider background, geometric pattern, vibrant accent colors, professional slide transition",
          twoColumn: "split comparison illustration, side by side concept, professional infographic style, clean modern design",
          titleContent: "professional presentation content slide, relevant topic illustration, clean minimal design, high quality",
          comparison: "versus comparison graphic, two sides, professional infographic style, clean split layout",
          imageFocused: "stunning hero image, cinematic composition, professional photography, dramatic lighting",
          numberedSteps: "step by step process flow, numbered stages, professional infographic, clean sequential design",
        }
        const layoutHint = layoutPrompts[slide.layout] || layoutPrompts.titleContent
        const prompt = `${slide.title}, ${args.topic}, ${layoutHint}`
        const encoded = encodeURIComponent(prompt)
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=450&nologo=true&seed=${Math.floor(Math.random() * 10000)}`

        // Find the slide ID and update it
        const slideRecord = await ctx.runQuery("presentations:listSlides", { presentationId })
        const targetSlide = slideRecord?.find((s: any) => s.order === slide.order)
        if (targetSlide) {
          await ctx.runMutation("presentations:updateSlideImage", { slideId: targetSlide._id, imageUrl })
        }
      } catch (e) {
        console.warn(`[Presentation] Failed to generate image for slide ${slide.order}:`, e)
      }
    }

    await ctx.runMutation("users:adjustCredits", {
      userId: args.userId,
      amount: -(slides.length * 2),
    })

    return { presentationId }
  },
})

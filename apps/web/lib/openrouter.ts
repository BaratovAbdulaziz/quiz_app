const OPENROUTER_API_KEYS = (process.env.OPENROUTER_API_KEYS || "").split(",").map(s => s.trim()).filter(Boolean)
const OPENROUTER_BASE = "https://openrouter.ai/api/v1"
const FREE_MODELS = ["openrouter/free", "meta-llama/llama-3.3-70b-instruct:free", "meta-llama/llama-3.2-3b-instruct:free", "qwen/qwen3-coder:free"]

export interface AiGenerateOptions {
  prompt: string
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface AiResponse {
  content: string
  model: string
  tokensUsed: number
}

function normalizeQuestion(q: any) {
  return {
    text: q.text || q.question || q.questionText || q.prompt || "",
    options: q.options || q.answers || q.choices || q.answerOptions || [],
    correctIndex: q.correctIndex ?? q.correctAnswer ?? q.correct ?? q.answerIndex ?? 0,
    explanation: q.explanation || q.explain || q.reasoning || q.feedback || undefined,
  }
}

export async function callOpenRouter(options: AiGenerateOptions, modelIdx = 0, keyIndex = 0, rateLimitRetries = 0, onLog?: (msg: string) => void): Promise<AiResponse> {
  const apiKey = OPENROUTER_API_KEYS[keyIndex]
  if (!apiKey) throw new Error("No OpenRouter API keys configured")

  const model = options.model || FREE_MODELS[modelIdx]
  if (!model) {
    if (keyIndex + 1 < OPENROUTER_API_KEYS.length) {
      onLog?.(`Keys exhausted — switching to key ${keyIndex + 2}`)
      return callOpenRouter(options, 0, keyIndex + 1, rateLimitRetries, onLog)
    }
    throw new Error("All models exhausted")
  }

  onLog?.(`Trying ${model}...`)
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a helpful quiz generation assistant. Return only valid JSON." },
        { role: "user", content: options.prompt },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    if (res.status === 429 || res.status >= 500 || res.status === 402) {
      const snippet = body.slice(0, 150)
      onLog?.(`✗ ${model} failed (HTTP ${res.status})`)
      if (modelIdx + 1 < FREE_MODELS.length) {
        await new Promise(r => setTimeout(r, 1500))
        return callOpenRouter(options, modelIdx + 1, keyIndex, rateLimitRetries, onLog)
      }
      if (keyIndex + 1 < OPENROUTER_API_KEYS.length) {
        await new Promise(r => setTimeout(r, 1500))
        return callOpenRouter(options, 0, keyIndex + 1, rateLimitRetries, onLog)
      }
      if (res.status === 429 && rateLimitRetries < 2) {
        onLog?.(`⚠ All models rate limited — retrying in 30s (attempt ${rateLimitRetries + 1}/2)`)
        await new Promise(r => setTimeout(r, 30000))
        return callOpenRouter(options, 0, 0, rateLimitRetries + 1, onLog)
      }
      throw new Error(`OpenRouter all models exhausted (key ${keyIndex + 1}/${OPENROUTER_API_KEYS.length}). Last error: HTTP ${res.status} — ${snippet}`)
    }
    const text = body || await res.text().catch(() => "")
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const message = choice?.message
  if (message?.refusal) throw new Error(`AI refused: ${message.refusal}`)
  const content = message?.content
  const finishReason = choice?.finish_reason ?? "unknown"
  if (!content) {
    if (finishReason === "length" || finishReason === "error") {
      onLog?.(`✗ ${model} returned ${finishReason} with no content`)
      if (modelIdx + 1 < FREE_MODELS.length) {
        await new Promise(r => setTimeout(r, 1000))
        return callOpenRouter(options, modelIdx + 1, keyIndex, rateLimitRetries, onLog)
      }
      if (keyIndex + 1 < OPENROUTER_API_KEYS.length) {
        await new Promise(r => setTimeout(r, 1000))
        return callOpenRouter(options, 0, keyIndex + 1, rateLimitRetries, onLog)
      }
      const msg = finishReason === "length" ? "truncated on all models — try a smaller PDF" : "error on all models"
      throw new Error(`AI response ${msg}`)
    }
    const detail = JSON.stringify({ finish_reason: finishReason, message, model: data.model }).slice(0, 500)
    throw new Error(`Empty response from AI (${finishReason}) — ${detail}`)
  }

  onLog?.(`✓ ${model} succeeded (${data.model})`)
  return {
    content,
    model: data.model,
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

function repairJson(raw: string): string {
  let s = raw.trim()

  // Strip markdown code fences
  s = s.replace(/```json|```/g, "").trim()

  // Extract first JSON object or array
  const firstBrace = s.indexOf("{")
  const firstBracket = s.indexOf("[")
  const jsonStart = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket
  if (jsonStart < 0) return s
  s = s.slice(jsonStart)

  // Match balanced braces/brackets to get the full JSON structure
  let depth = 0
  let inString = false
  let escape = false
  let end = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escape) { escape = false; continue }
    if (ch === "\\" && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{" || ch === "[") depth++
    else if (ch === "}" || ch === "]") {
      depth--
      if (depth === 0) { end = i + 1; break }
    }
  }
  if (end > 0) s = s.slice(0, end)

  // Remove trailing commas before closing braces/brackets
  s = s.replace(/,(\s*[}\]])/g, "$1")

  // Replace single quotes with double quotes (but not inside existing double-quoted strings)
  let result = ""
  inString = false
  escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escape) { result += ch; escape = false; continue }
    if (ch === "\\" && inString) { result += ch; escape = true; continue }
    if (ch === '"') { result += ch; inString = !inString; continue }
    if (inString) { result += ch; continue }
    if (ch === "'") { result += '"'; continue }
    result += ch
  }

  // Quote unquoted keys (identifier: before colon, not in string)
  result = result.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')

  return result
}

export async function parsePdfQuestions(pdfText: string, onLog?: (msg: string) => void): Promise<{
  questions: Array<{ text: string; options: string[]; correctIndex: number; explanation?: string }>
}> {
  const prompt = `Extract all multiple-choice questions from the following text. Clean up each question: remove any leading option letter prefixes (like "a) " or "A. ") from the options, and infer the correct answer index. Return ONLY valid JSON with no markdown formatting:

{
  "questions": [
    {
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Optional explanation"
    }
  ]
}

Text to parse:
${pdfText.slice(0, 10000)}`

  const prompts = [
    prompt,
    `Extract all multiple-choice questions from the text below. Return ONLY a valid JSON object — no reasoning, no markdown, no explanation. Just the JSON:\n{"questions": [{"text": "...", "options": ["...","...","...","..."], "correctIndex": 0}]}\n\nText:\n${pdfText.slice(0, 10000)}`,
  ]

  let lastError = ""
  for (let pass = 0; pass < 2; pass++) {
    const p = prompts[pass]
    onLog?.(pass === 1 ? "Retrying with stricter prompt..." : "Parsing PDF...")
    for (let attempt = 0; attempt < Math.min(FREE_MODELS.length, 3); attempt++) {
      const response = await callOpenRouter({ prompt: p, temperature: 0.1, maxTokens: 8192 }, attempt, 0, 0, onLog)
      const cleaned = repairJson(response.content)
      if (!cleaned.includes("{") && !cleaned.includes("[")) {
        lastError = "No JSON found in response"
        continue
      }
      try {
        const parsed = JSON.parse(cleaned)
        if (!Array.isArray(parsed.questions)) {
          throw new Error("No questions found in AI response")
        }
        parsed.questions = parsed.questions.map(normalizeQuestion)
        onLog?.(`✓ Parsed ${parsed.questions.length} questions from PDF`)
        return parsed
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Parse failed"
      }
    }
  }

  onLog?.(`✗ All attempts failed — ${lastError}`)
  throw new Error(`AI parsing failed after 3 attempts: ${lastError}`)
}

export async function generateQuizQuestions(topic: string, count: number = 5): Promise<{
  questions: Array<{ text: string; options: string[]; correctIndex: number; explanation?: string }>
  clarificationNeeded?: string
}> {
  const prompt = `Generate ${count} multiple-choice quiz questions about "${topic}". Return ONLY valid JSON with no markdown formatting:

{
  "questions": [
    {
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this is correct"
    }
  ]
}

If the topic is too vague, set "clarificationNeeded" to a clarifying question instead.`

  let lastError = ""
  for (let attempt = 0; attempt < Math.min(FREE_MODELS.length, 3); attempt++) {
    try {
      const response = await callOpenRouter({ prompt, temperature: 0.7, maxTokens: 8192 }, attempt)
      const cleaned = repairJson(response.content)
      let parsed: any
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        throw new Error(`AI returned unexpected response. Try a different topic. (${cleaned.slice(0, 80)})`)
      }

      if (parsed.clarificationNeeded) {
        return { questions: [], clarificationNeeded: parsed.clarificationNeeded }
      }

      if (!Array.isArray(parsed.questions)) {
        throw new Error("No questions generated")
      }

      parsed.questions = parsed.questions.map(normalizeQuestion)
      return parsed
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Generation failed"
    }
  }
  throw new Error(`AI generation failed: ${lastError}`)
}

export async function generateWithClarification(
  topic: string,
  clarificationAnswer: string,
  count: number = 5,
): Promise<{
  questions: Array<{ text: string; options: string[]; correctIndex: number; explanation?: string }>
}> {
  const prompt = `Generate ${count} multiple-choice quiz questions about "${topic}". The user specified: "${clarificationAnswer}". Return ONLY valid JSON with no markdown formatting:

{
  "questions": [
    {
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this is correct"
    }
  ]
}`

  let lastError = ""
  for (let attempt = 0; attempt < Math.min(FREE_MODELS.length, 3); attempt++) {
    try {
      const response = await callOpenRouter({ prompt, temperature: 0.7, maxTokens: 8192 }, attempt)
      const cleaned = repairJson(response.content)
      let parsed: any
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        throw new Error(`AI returned unexpected response. Try a different clarification. (${cleaned.slice(0, 80)})`)
      }
      if (!Array.isArray(parsed.questions)) {
        throw new Error("No questions generated")
      }
      parsed.questions = parsed.questions.map(normalizeQuestion)
      return parsed
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Generation failed"
    }
  }
  throw new Error(`AI generation failed: ${lastError}`)
}

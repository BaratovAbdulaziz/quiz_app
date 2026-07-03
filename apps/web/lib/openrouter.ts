const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE = "https://openrouter.ai/api/v1"
const DEFAULT_MODEL = "openai/gpt-4o-mini"
const FALLBACK_MODEL = "mistralai/mistral-7b-instruct"

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

async function callOpenRouter(options: AiGenerateOptions): Promise<AiResponse> {
  const model = options.model || DEFAULT_MODEL

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
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
    if (res.status === 429 && model !== FALLBACK_MODEL) {
      return callOpenRouter({ ...options, model: FALLBACK_MODEL })
    }
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty response from AI")

  return {
    content,
    model: data.model,
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

export async function parsePdfQuestions(pdfText: string): Promise<{
  questions: Array<{ text: string; options: string[]; correctIndex: number; explanation?: string }>
}> {
  const prompt = `Extract all multiple-choice questions from the following text. Return ONLY valid JSON with no markdown formatting:

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
${pdfText.slice(0, 15000)}`

  const response = await callOpenRouter({ prompt, temperature: 0.1 })
  const cleaned = response.content.replace(/```json|```/g, "").trim()
  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed.questions)) {
    throw new Error("No questions found in AI response")
  }

  return parsed
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

  const response = await callOpenRouter({ prompt, temperature: 0.7 })
  const cleaned = response.content.replace(/```json|```/g, "").trim()
  const parsed = JSON.parse(cleaned)

  if (parsed.clarificationNeeded) {
    return { questions: [], clarificationNeeded: parsed.clarificationNeeded }
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error("No questions generated")
  }

  return parsed
}

export async function generateWithClarification(
  topic: string,
  clarificationAnswer: string,
  count: number = 5,
): Promise<{
  questions: Array<{ text: string; options: string[]; correctIndex: number; explanation?: string }>
}> {
  const prompt = `Generate ${count} multiple-choice quiz questions about "${topic}". The user specified: "${clarificationAnswer}". Return ONLY valid JSON.`

  const response = await callOpenRouter({ prompt, temperature: 0.7 })
  const cleaned = response.content.replace(/```json|```/g, "").trim()
  return JSON.parse(cleaned)
}

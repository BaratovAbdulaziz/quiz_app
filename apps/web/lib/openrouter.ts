const OPENROUTER_API_KEYS = (process.env.OPENROUTER_API_KEYS || "").split(",").map(s => s.trim()).filter(Boolean)
const OPENROUTER_BASE = "https://openrouter.ai/api/v1"
const FREE_MODELS = ["openrouter/free"]

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

export async function callOpenRouter(options: AiGenerateOptions, modelIdx = 0, keyIndex = 0): Promise<AiResponse> {
  const apiKey = OPENROUTER_API_KEYS[keyIndex]
  if (!apiKey) throw new Error("No OpenRouter API keys configured")

  const model = options.model || FREE_MODELS[modelIdx]
  if (!model) {
    if (keyIndex + 1 < OPENROUTER_API_KEYS.length) return callOpenRouter(options, 0, keyIndex + 1)
    throw new Error("All models exhausted")
  }

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
    if (res.status === 429 || res.status >= 500 || res.status === 402) {
      return callOpenRouter(options, modelIdx + 1, keyIndex)
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

  parsed.questions = parsed.questions.map(normalizeQuestion)
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

  const response = await callOpenRouter({ prompt, temperature: 0.7 })
  const cleaned = response.content.replace(/```json|```/g, "").trim()
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
}

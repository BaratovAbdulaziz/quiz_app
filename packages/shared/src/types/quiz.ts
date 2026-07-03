export interface QuestionData {
  id: string
  text: string
  options: string[]
  correctIndex: number
  explanation?: string
  order: number
}

export interface QuizData {
  id: string
  title: string
  description?: string
  source: "uploaded_pdf" | "ai_generated"
  questionCount: number
  randomize: boolean
  folderId?: string
  createdAt: string
  questions: QuestionData[]
}

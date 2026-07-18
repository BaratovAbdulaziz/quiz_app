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

export interface SlideData {
  id: string
  title: string
  content: string[]
  layout: "title" | "titleContent" | "twoColumn" | "imageContent" | "blank" | "sectionDivider" | "stats" | "quote"
  order: number
  imageUrl?: string
}

export interface PresentationData {
  id: string
  title: string
  description?: string
  source: "ai_generated" | "manual"
  slideCount: number
  folderId?: string
  createdAt: string
  slides: SlideData[]
}

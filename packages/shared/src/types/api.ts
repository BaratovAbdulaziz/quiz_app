export interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}

export interface UserSettings {
  displayName: string
  theme: "light" | "dark" | "system"
  language: "en" | "uz" | "ru"
  credits: number
  creditsRefreshAt: string
}

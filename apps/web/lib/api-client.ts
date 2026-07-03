const BASE = process.env.NEXT_PUBLIC_API_URL || ""

let accessToken: string | null = null

export function setToken(token: string | null) {
  accessToken = token
  if (token) {
    localStorage.setItem("access_token", token)
  } else {
    localStorage.removeItem("access_token")
  }
}

export function getToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem("access_token")
  }
  return accessToken
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token")
  if (!refreshToken) return false

  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setToken(data.data.accessToken)
    localStorage.setItem("refresh_token", data.data.refreshToken)
    return true
  } catch {
    return false
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  const token = getToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  let res = await fetch(`${BASE}/api${path}`, { ...options, headers })

  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getToken()}`
      res = await fetch(`${BASE}/api${path}`, { ...options, headers })
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(err.error?.message || "Request failed")
  }

  return res.json()
}

export async function loginWithTelegram(initData: string) {
  return api<{
    data: {
      accessToken: string
      refreshToken: string
      user: {
        id: string
        telegramId: number
        username: string | null
        displayName: string
        photoUrl: string | null
        languageCode: string
        credits: number
        creditsRefreshAt: string
      }
    }
  }>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData }),
  })
}

export async function fetchMe() {
  return api<{
    data: {
      id: string
      telegramId: number
      username: string | null
      displayName: string
      photoUrl: string | null
      languageCode: string
      credits: number
      creditsRefreshAt: string
    }
  }>("/me")
}

export async function fetchQuizzes(params?: { folderId?: string; search?: string }) {
  const query = new URLSearchParams()
  if (params?.folderId) query.set("folderId", params.folderId)
  if (params?.search) query.set("search", params.search)
  const qs = query.toString()
  return api<{ data: Array<Record<string, unknown>> }>(`/quizzes${qs ? `?${qs}` : ""}`)
}

export async function fetchQuiz(id: string) {
  return api<{ data: Record<string, unknown> }>(`/quizzes/${id}`)
}

export async function fetchFolders() {
  return api<{ data: Array<Record<string, unknown>> }>("/folders")
}

export async function createFolder(name: string) {
  return api<{ data: Record<string, unknown> }>("/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function startSession(quizId: string, mode: "practice" | "exam") {
  return api<{ data: Record<string, unknown> }>(`/quizzes/${quizId}/sessions`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  })
}

export async function submitAnswer(sessionId: string, questionId: string, selectedIndex: number) {
  return api<{ data: Record<string, unknown> }>(`/sessions/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ questionId, selectedIndex }),
  })
}

export async function skipQuestion(sessionId: string, questionId: string) {
  return api<{ data: Record<string, unknown> }>(`/sessions/${sessionId}/skip`, {
    method: "POST",
    body: JSON.stringify({ questionId }),
  })
}

export async function completeSession(sessionId: string, timeSeconds?: number) {
  return api<{ data: Record<string, unknown> }>(`/sessions/${sessionId}/complete`, {
    method: "POST",
    body: JSON.stringify({ timeSeconds }),
  })
}

export async function generateAIQuiz(body: { topic: string; description?: string; folderId?: string | null; clarificationAnswer?: string }) {
  return api<{ data: Record<string, unknown> }>("/ai/generate", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function generateShareLink(quizId: string) {
  return api<{ data: { token: string; url: string } }>(`/quizzes/${quizId}/share`, {
    method: "POST",
  })
}

export async function reportQuestion(questionId: string, reason: string, comment?: string) {
  return api<{ data: Record<string, unknown> }>(`/questions/${questionId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, comment }),
  })
}

export async function fetchCredits() {
  return api<{ data: { balance: number; refreshAt: string } }>("/ai/credits")
}

export async function updateSettings(settings: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>("/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  })
}

export async function deleteAccount() {
  return api<{ data: { success: boolean } }>("/account", { method: "DELETE" })
}

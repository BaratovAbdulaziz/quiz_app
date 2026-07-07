"use client"

import { useState, useEffect, useRef } from "react"
import { Loader } from "@/components/ui/loader"
import { cn } from "@/lib/utils"
import { ArrowLeft, Check, ChevronDown, ChevronRight, Clock, Edit2, FileText, Folder, LogOut, Plus, Search, Settings, Share2, Trash2, Upload, X } from "lucide-react"
import Logo from "./Logo"
import en from "@/i18n/en.json"
import uz from "@/i18n/uz.json"
import ru from "@/i18n/ru.json"
import {
  setToken, setClerkTokenGetter, loginWithTelegram, loginWithClerk, fetchMe, fetchQuizzes, fetchQuiz, generateAIQuiz,
  fetchFolders, createFolder, updateFolder, deleteFolder, deleteFolders, deleteQuizzes, moveQuizzes, updateQuiz, deleteQuiz,
  startSession, submitAnswer, skipQuestion,
  completeSession, fetchSession, generateShareLink, updateSettings, deleteAccount,
} from "@/lib/api-client"
import { useUser, useAuth, useClerk } from "@clerk/nextjs"
import GoogleSignInButton from "@/components/auth/GoogleSignInButton"

type Screen = "login" | "library" | "overview" | "practice" | "exam" | "results" | "settings" | "admin"

interface Question {
  id: string
  text: string
  options: string[]
  correctIndex: number
  explanation?: string
}

interface Quiz {
  id: string
  title: string
  description: string
  questionCount: number
  source: string
  createdAt: string
  folderId: string | null
  questions: Question[]
}

interface Folder {
  id: string
  name: string
  quizCount: number
}

interface UserInfo {
  id: string
  telegramId: number | null
  clerkId: string | null
  email: string | null
  authProvider: string
  username: string | null
  displayName: string
  photoUrl: string | null
  languageCode: string
  credits: number
  creditsRefreshAt: string
}

type SessionData = {
  session: { id: string; quizId: string; mode: "practice" | "exam"; status: string; total: number }
  questions: Array<{
    id: string
    text: string
    options: string[]
    correctIndex: number
    explanation: string | null
  }>
}

const T = { en, uz, ru } as const
type Lang = keyof typeof T

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024

function sanitize(str: string): string {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"']/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim()
    .slice(0, 5000)
}

const PROGRESS_KEY = "quiz_progress"

function saveProgress(quizId: string, sessionId: string, mode: "practice" | "exam", currentIdx: number, answers: Record<string, number>, skipped: Set<string>, submitted: Set<string>) {
  if (!sessionId) return
  const data = { quizId, sessionId, mode, currentIdx, answers: JSON.stringify(answers), skipped: JSON.stringify([...skipped]), submitted: JSON.stringify([...submitted]), timestamp: Date.now() }
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)) } catch {}
}

function loadProgress(quizId: string): { sessionId: string; mode: "practice" | "exam"; currentIdx: number; answers: Record<string, number>; skipped: Set<string>; submitted: Set<string> } | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.quizId !== quizId || !data.sessionId) return null
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) { localStorage.removeItem(PROGRESS_KEY); return null }
    return {
      sessionId: data.sessionId, mode: data.mode, currentIdx: data.currentIdx,
      answers: JSON.parse(data.answers), skipped: new Set(JSON.parse(data.skipped)), submitted: new Set(JSON.parse(data.submitted)),
    }
  } catch { return null }
}

function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY) } catch {}
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error("Failed to read file"))
    r.readAsText(file)
  })
}

function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(new Error("Failed to read file"))
    r.readAsArrayBuffer(file)
  })
}

function App() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { getToken: getClerkToken } = useAuth()
  const { signOut: clerkSignOut } = useClerk()

  const [screen, setScreen] = useState<Screen>("login")
  const [user, setUser] = useState<UserInfo | null>(null)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null)
  const [examTimeLeft, setExamTimeLeft] = useState(0)
  const [results, setResults] = useState<{ correct: number; total: number; timeTaken?: number; answers: Record<string, number>; skipped: Set<string> } | null>(null)
  const [savedProgress, setSavedProgress] = useState<{ sessionId: string; mode: "practice" | "exam"; currentIdx: number } | null>(null)
  const [retryIds, setRetryIds] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [randomize, setRandomize] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [usernameError, setUsernameError] = useState("")
  const [usernameSaved, setUsernameSaved] = useState(false)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [language, setLanguage] = useState<Lang>("en")
  const [darkMode, setDarkMode] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null)
  const [pendingGeneration, setPendingGeneration] = useState<{ title: string; description: string; folderId: string | null; questionCount: number } | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renamingQuizId, setRenamingQuizId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionMode, setSessionMode] = useState<"practice" | "exam">("practice")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadQuestionsPerQuiz, setUploadQuestionsPerQuiz] = useState(10)
  const [uploadProcessing, setUploadProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [uploadLogs, setUploadLogs] = useState<string[]>([])
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null)
  const [siteKilled, setSiteKilled] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [adminAttempts, setAdminAttempts] = useState(0)
  const [clerkAuthError, setClerkAuthError] = useState(false)
  const [adminError, setAdminError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [botStatus, setBotStatus] = useState("checking")
  const [cfg, setCfg] = useState<Record<string, string> | null>(null)
  const [dirty, setDirty] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [allUsers, setAllUsers] = useState<Array<{ id: string; telegramId: number; telegramUsername: string | null; displayName: string; credits: number; tokens: number }>>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [creditMsg, setCreditMsg] = useState("")
  const keyTestStatus = useRef<Record<number, { testing: boolean; result: string }>>({})
  const [, forceRender] = useState(0)

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/users?password=2312")
      const d = await res.json()
      if (d.data) setAllUsers(d.data)
    } catch {}
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/bot").then(r => r.json()).catch(() => ({ data: { status: "stopped" } })),
      fetch("/api/admin/config").then(r => r.json()).catch(() => ({ data: null })),
      loadUsers(),
    ]).then(([bot, c]) => {
      setBotStatus(bot.data?.status || "stopped")
      setCfg(c.data)
    })
  }, [])

  const t = (key: string): string => {
    const lang = T[language]
    return (lang as Record<string, string>)[key] ?? (T.en as Record<string, string>)[key] ?? key
  }

  useEffect(() => {
    const stored = localStorage.getItem("theme")
    if (stored === "dark") setDarkMode(true)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
    localStorage.setItem("theme", darkMode ? "dark" : "light")
  }, [darkMode])

  useEffect(() => {
    if (sessionId && selectedQuiz) {
      saveProgress(selectedQuiz.id, sessionId, sessionMode, currentIdx, answers, skipped, submitted)
    }
  }, [sessionId, selectedQuiz?.id, sessionMode, currentIdx, answers, skipped, submitted])

  useEffect(() => {
    setClerkTokenGetter(() => getClerkToken())
  }, [getClerkToken])

  useEffect(() => {
    async function init() {
      if (clerkLoaded && clerkUser) {
        try {
          const clerkToken = await getClerkToken()
          if (clerkToken) {
            const result = await loginWithClerk(clerkToken)
            setToken(result.data.accessToken)
            localStorage.setItem("refresh_token", result.data.refreshToken)
            setUser(result.data.user)
            setDisplayName(result.data.user.displayName)
            setUsername(result.data.user.username || "")
            setLanguage((result.data.user.languageCode as Lang) || "en")
            setScreen("library")
            loadLibrary()
          } else {
            console.error("[auth] getClerkToken returned null — Clerk session may be invalid")
            setClerkAuthError(true)
          }
        } catch (e) {
          console.error("[auth] Clerk exchange failed", e)
          setClerkAuthError(true)
        }
      }
      if (!clerkUser) {
        const token = localStorage.getItem("access_token")
        if (token) {
          setToken(token)
          try {
            const me = await fetchMe()
            setUser(me.data)
            setDisplayName(me.data.displayName)
            setUsername(me.data.username || "")
            setLanguage((me.data.languageCode as Lang) || "en")
            setScreen("library")
            loadLibrary()
          } catch (e) {
            console.error("[auth] Stored token invalid", e)
            setToken(null)
            tryTelegramLogin()
          }
        } else {
          tryTelegramLogin()
        }
      }
      setLoading(false)
    }
    if (clerkLoaded) {
      init()
    }
    fetch("/api/admin/kill").then(r => r.json()).then(d => { if (d.data?.killed) setSiteKilled(true) }).catch(() => {})
  }, [clerkLoaded, clerkUser])

  async function tryTelegramLogin() {
    try {
      const tg = (window as any).Telegram?.WebApp
      if (tg?.initData) {
        const result = await loginWithTelegram(tg.initData)
        setToken(result.data.accessToken)
        localStorage.setItem("refresh_token", result.data.refreshToken)
        setUser(result.data.user)
        setDisplayName(result.data.user.displayName)
        setUsername(result.data.user.username || "")
        setLanguage((result.data.user.languageCode as Lang) || "en")
        setScreen("library")
        loadLibrary()
      }
    } catch (e) {
      console.error("[auth] Telegram login failed", e)
    }
  }

  async function loadLibrary() {
    try {
      const [qRes, fRes] = await Promise.all([
        fetchQuizzes(),
        fetchFolders(),
      ])
      setQuizzes((qRes.data ?? []) as unknown as Quiz[])
      setFolders((fRes.data ?? []) as Folder[])
    } catch {
      // silent
    }
  }

  async function handleRenameFolder(folderId: string) {
    if (!editName.trim()) { setRenamingFolderId(null); return }
    try {
      await updateFolder(folderId, { name: editName.trim() })
      setFolders(p => p.map(f => f.id === folderId ? { ...f, name: editName.trim() } : f))
    } catch {}
    setRenamingFolderId(null)
  }

  async function handleDeleteFolder(folderId: string) {
    if (!confirm("Delete this folder and remove all quizzes from it?")) return
    try {
      await deleteFolder(folderId)
      setFolders(p => p.filter(f => f.id !== folderId))
      setQuizzes(p => p.map(q => q.folderId === folderId ? { ...q, folderId: null } : q))
    } catch {}
  }

  async function handleRenameQuiz(quizId: string) {
    if (!editName.trim()) { setRenamingQuizId(null); return }
    try {
      await updateQuiz(quizId, { title: editName.trim() })
      setQuizzes(p => p.map(q => q.id === quizId ? { ...q, title: editName.trim() } : q))
    } catch {}
    setRenamingQuizId(null)
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!confirm("Delete this quiz?")) return
    try {
      await deleteQuiz(quizId)
      setQuizzes(p => p.filter(q => q.id !== quizId))
    } catch {}
  }

  async function handleDrop(e: React.DragEvent, folderId: string | null) {
    const quizId = e.dataTransfer.getData("text/quiz-id")
    if (!quizId) return
    try {
      await updateQuiz(quizId, { folderId })
      setQuizzes(p => p.map(q => q.id === quizId ? { ...q, folderId } : q))
    } catch {}
  }

  function handleDragStart(e: React.DragEvent, quizId: string) {
    e.dataTransfer.setData("text/quiz-id", quizId)
    e.dataTransfer.effectAllowed = "move"
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  async function handleBatchDelete() {
    const quizIds: string[] = []
    const folderIds: string[] = []
    selectedIds.forEach(id => {
      if (folders.some(f => f.id === id)) folderIds.push(id)
      else quizIds.push(id)
    })
    try {
      if (quizIds.length) await deleteQuizzes(quizIds)
      if (folderIds.length) await deleteFolders(folderIds)
      setQuizzes(p => p.filter(q => !selectedIds.has(q.id)))
      setFolders(p => p.filter(f => !selectedIds.has(f.id)))
      clearSelection()
    } catch {}
    setShowDeleteConfirm(false)
  }

  async function handleBatchMove(folderId: string | null) {
    const quizIds = [...selectedIds].filter(id => !folders.some(f => f.id === id))
    if (!quizIds.length) return
    try {
      await moveQuizzes(quizIds, folderId)
      setQuizzes(p => p.map(q => quizIds.includes(q.id) ? { ...q, folderId } : q))
      clearSelection()
    } catch {}
  }

  const quiz = selectedQuiz
  const allQ = quiz?.questions ?? []
  const curQ = allQ[currentIdx]
  const isExam = screen === "exam"
  const activeQ = retryIds.size > 0 ? allQ.filter(q => retryIds.has(q.id)) : allQ

  function go(s: Screen) { setScreen(s) }

  async function doLogin() {
    const tg = (window as any).Telegram?.WebApp
    if (tg?.initData) {
      await tryTelegramLogin()
    } else if (typeof window !== "undefined" && !!(window as any).Telegram?.WebApp) {
      tg.openTelegramLink("https://web.telegram.org/k/#@Quiz_talaba_bot")
    } else {
      window.open("https://web.telegram.org/k/#@Quiz_talaba_bot", "_blank")
    }
  }

  async function openQuiz(q: Quiz) {
    if (!q.questions?.length) {
      try {
        const res = await fetchQuiz(q.id)
        q = { ...q, questions: ((res.data as any)?.questions ?? []).map((x: any, i: number) => ({ ...x, id: x.id || crypto.randomUUID(), order: i, explanation: x.explanation ?? undefined })) }
      } catch {}
    }
    setSelectedQuiz(q); setCurrentIdx(0); setAnswers({}); setSubmitted(new Set())
    setSkipped(new Set()); setShowFeedback(false); setSelectedOpt(null); setResults(null); setRetryIds(new Set())
    const prog = loadProgress(q.id)
    setSavedProgress(prog ? { sessionId: prog.sessionId, mode: prog.mode, currentIdx: prog.currentIdx } : null)
    go("overview")
  }

  async function startPractice() {
    if (!quiz) return
    clearProgress()
    setSavedProgress(null)
    try {
      const result = await startSession(quiz.id, "practice")
      const sData = result.data as SessionData
      setSessionId(sData.session.id)
      setSessionMode("practice")
      if (sData.questions.length > 0) {
        setSelectedQuiz(prev => prev ? { ...prev, questions: sData.questions.map(q => ({ ...q, explanation: q.explanation ?? undefined })) } : prev)
      }
      setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
      setShowFeedback(false); setSelectedOpt(null); go("practice")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start practice")
    }
  }

  async function startExam() {
    if (!quiz) return
    clearProgress()
    setSavedProgress(null)
    try {
      const result = await startSession(quiz.id, "exam")
      const sData = result.data as SessionData
      setSessionId(sData.session.id)
      setSessionMode("exam")
      if (sData.questions.length > 0) {
        setSelectedQuiz(prev => prev ? { ...prev, questions: sData.questions.map(q => ({ ...q, explanation: q.explanation ?? undefined })) } : prev)
      }
      setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
      setShowFeedback(false); setSelectedOpt(null); setExamTimeLeft((sData.questions.length || quiz.questionCount) * 60); go("exam")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start exam")
    }
  }

  function answer(i: number) {
    if (isExam) {
      setAnswers(p => ({ ...p, [curQ.id]: i }))
      if (sessionId) { submitAnswer(sessionId, curQ.id, i).catch(() => {}) }
    } else {
      setSelectedOpt(i)
    }
  }

  function submitAns() {
    if (selectedOpt === null) return
    setAnswers(p => ({ ...p, [curQ.id]: selectedOpt }))
    setSubmitted(p => new Set(p).add(curQ.id)); setShowFeedback(true)
    if (sessionId) { submitAnswer(sessionId, curQ.id, selectedOpt).catch(() => {}) }
  }

  async function doSkip() {
    setSkipped(p => new Set(p).add(curQ.id))
    setSubmitted(p => new Set(p).add(curQ.id))
    if (sessionId) {
      try { await skipQuestion(sessionId, curQ.id) } catch {}
    }
    if (currentIdx < activeQ.length - 1) { setCurrentIdx(i => i + 1) }
    else finish()
    setShowFeedback(false); setSelectedOpt(null)
  }

  async function doNext() {
    if (currentIdx < activeQ.length - 1) { setCurrentIdx(i => i + 1); setShowFeedback(false); setSelectedOpt(null) }
    else finish()
  }

  async function finish() {
    let correct = 0
    for (const q of activeQ) { if (answers[q.id] === q.correctIndex) correct++ }
    if (sessionId) {
      try {
        const timeSeconds = isExam ? allQ.length * 60 - examTimeLeft : undefined
        await completeSession(sessionId, timeSeconds)
      } catch {}
    }
    clearProgress()
    setSavedProgress(null)
    setResults({ correct, total: activeQ.length, timeTaken: isExam ? allQ.length * 60 - examTimeLeft : undefined, answers, skipped })
    go("results")
  }

  function retryIncorrect() {
    const ids = new Set<string>()
    for (const q of activeQ) { if (answers[q.id] !== q.correctIndex) ids.add(q.id) }
    if (!ids.size) return
    clearProgress()
    setSavedProgress(null)
    setRetryIds(ids); setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
    setShowFeedback(false); setSelectedOpt(null); go("practice")
  }

  function restart() {
    clearProgress()
    setSavedProgress(null)
    setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
    setShowFeedback(false); setSelectedOpt(null); setRetryIds(new Set()); go("overview")
  }

  async function resumeQuiz() {
    const prog = savedProgress
    if (!prog || !quiz) return
    try {
      const result = await fetchSession(prog.sessionId)
      const d = result.data
      setSessionId(prog.sessionId)
      setSessionMode(prog.mode)
      const qs = (d.questions as any[]).map((x: any, i: number) => ({ ...x, id: x.id || crypto.randomUUID(), order: i, explanation: x.explanation ?? undefined }))
      setSelectedQuiz(prev => prev ? { ...prev, questions: qs } : prev)
      const prog2 = loadProgress(quiz.id)
      setCurrentIdx(prog2?.currentIdx ?? prog.currentIdx)
      setAnswers(prog2?.answers ?? {})
      setSkipped(prog2?.skipped ?? new Set())
      setSubmitted(prog2?.submitted ?? new Set())
      setShowFeedback(false); setSelectedOpt(null)
      if (prog.mode === "exam") {
        setExamTimeLeft(qs.length * 60)
      }
      go(prog.mode === "exam" ? "exam" : "practice")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resume session")
    }
  }

  async function addFolder(name: string) {
    if (!name.trim()) return ""
    try {
      const result = await createFolder(name.trim())
      const f = result.data as Folder
      setFolders(p => [...p, f])
      setExpandedFolders(p => new Set(p).add(f.id))
      setNewFolderName("")
      setShowNewFolderInput(false)
      return f.id
    } catch {
      return ""
    }
  }

  function toggleFolder(id: string) {
    setExpandedFolders(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function addNewQuiz(title: string, description: string, folderId: string | null) {
    const newQ: Quiz = {
      id: crypto.randomUUID(), title, description, questionCount: 0,
      source: "Manual", createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId, questions: [],
    }
    setQuizzes(p => [...p, newQ])
    setShowAddModal(false)
    openQuiz(newQ)
  }

  async function generateWithAI(title: string, description: string, folderId: string | null, questionCount?: number, clarificationAnswer?: string) {
    setGenerating(true)
    try {
      const result = await generateAIQuiz({ topic: title, description, folderId, questionCount, clarificationAnswer })
      const data = result as any
      if (data.data?.clarificationNeeded) {
        setGenerating(false)
        setClarificationQuestion(data.data.clarificationNeeded)
        setPendingGeneration({ title, description, folderId, questionCount: questionCount ?? 5 })
        return
      }
      const quiz = data.data?.quiz
      if (!quiz) throw new Error("No quiz data in response")
      if (data.data.questions) {
        quiz.questions = data.data.questions.map((q: any, i: number) => ({ ...q, id: crypto.randomUUID(), order: i }))
      }
      if (data.data.creditsRemaining != null) {
        setUser(prev => prev ? { ...prev, credits: data.data.creditsRemaining } : prev)
      }
      setQuizzes(p => [...p, quiz])
      setShowAddModal(false)
      setGenerating(false)
      openQuiz(quiz)
    } catch (err) {
      setGenerating(false)
      alert(err instanceof Error ? err.message : "Failed to generate quiz")
    }
  }

  function handleClarify(answer: string) {
    if (!pendingGeneration) return
    setClarificationQuestion(null)
    setPendingGeneration(null)
    generateWithAI(pendingGeneration.title, pendingGeneration.description, pendingGeneration.folderId, pendingGeneration.questionCount, answer)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (file.size > MAX_UPLOAD_SIZE) {
      alert("File too large (max 50MB)")
      return
    }

    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const buf = await readFileAsBuffer(file)
      const pdf = String.fromCharCode(...new Uint8Array(buf, 0, 5))
      if (pdf !== "%PDF-") { alert("Invalid PDF"); return }
      setPendingFile(file)
      setShowUploadModal(true)
      return
    }

    try {
      const text = await readFileAsText(file)
      const raw = JSON.parse(text)
      if (!raw || typeof raw !== "object") throw new Error()
      const title = sanitize(raw.title)
      if (!title) { alert("Quiz title is required"); return }
      const description = sanitize(raw.description ?? "")
      const rawQuestions: any[] = raw.questions ?? []
      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) { alert("No questions found"); return }
      const questions: Question[] = []
      for (let i = 0; i < rawQuestions.length; i++) {
        const rq = rawQuestions[i]
        if (!rq || typeof rq !== "object") continue
        const qt = sanitize(rq.text ?? "")
        const ro: any[] = rq.options ?? []
        if (!Array.isArray(ro) || ro.length < 2 || !qt) continue
        const opts = ro.map((o: any) => sanitize(String(o ?? ""))).filter(Boolean)
        if (opts.length < 2) continue
        const ci = typeof rq.correctIndex === "number" && rq.correctIndex >= 0 && rq.correctIndex < opts.length ? rq.correctIndex : 0
        questions.push({
          id: crypto.randomUUID(), text: qt, options: opts, correctIndex: ci,
          explanation: rq.explanation ? sanitize(rq.explanation) : undefined,
        })
      }
      if (questions.length === 0) { alert("No valid questions"); return }
      const q: Quiz = {
        id: crypto.randomUUID(), title, description, questionCount: questions.length,
        source: "Uploaded JSON", createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        folderId: null, questions,
      }
      setQuizzes(p => [...p, q])
      openQuiz(q)
    } catch {
      alert("Invalid file — expected PDF or JSON quiz file")
    }
  }

  async function handleUploadPdf() {
    const file = pendingFile
    if (!file) return
    setUploadProcessing(true)
    setUploadProgress("Uploading file…")
    setUploadLogs([])

    try {
      const formData = new FormData()
      formData.append("file", file)
      const token = localStorage.getItem("access_token")
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      })
      if (!uploadRes.ok) throw new Error("Upload failed")
      const uploadData = await uploadRes.json()
      setUploadLogs(p => [...p, "✓ File uploaded"])

      setUploadProgress("Parsing with AI…")
      const parseRes = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders } as Record<string, string>,
        body: JSON.stringify({
          fileId: uploadData.data.id,
          title: file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
          questionsPerQuiz: uploadQuestionsPerQuiz,
          folderId: uploadFolderId,
        }),
      })

      const reader = parseRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let resultData: any = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split("\n")
          let eventType = "message"
          let data = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7)
            else if (line.startsWith("data: ")) data += line.slice(6)
          }
          if (!data) continue
          const parsed = JSON.parse(data)
          if (eventType === "log") {
            setUploadLogs(p => [...p, parsed.message])
          } else if (eventType === "result") {
            resultData = parsed
          } else if (eventType === "error") {
            throw new Error(parsed.message || "Parse failed")
          }
        }
      }

      if (!resultData) throw new Error("No response from server")
      const quizzesArr = resultData.quizzes ?? []
      if (quizzesArr.length === 0) throw new Error("No quizzes created")
      setShowUploadModal(false)
      setPendingFile(null)
      setUploadProcessing(false)
      setUploadProgress("")
      setUploadLogs([])
      setQuizzes(p => [...p, ...quizzesArr])
      openQuiz(quizzesArr[0])
    } catch (err) {
      setShowUploadModal(false)
      setPendingFile(null)
      setUploadProcessing(false)
      setUploadProgress("")
      setUploadLogs([])
      alert(err instanceof Error ? err.message : "Failed to process PDF")
    }
  }

  if (siteKilled) {
    return (
      <div key="killed" className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 animate-fade-in">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-brand-error/10 flex items-center justify-center mx-auto">
            <Trash2 size={24} className="text-brand-error" />
          </div>
          <h1 className="text-heading-3 text-ink">Site Killed</h1>
          <p className="text-body-md text-steel leading-relaxed">
            This site has been taken down by the administrator.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    const isTelegram = typeof window !== "undefined" && !!(window as any).Telegram?.WebApp
    return (
      <div key="login" className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-hero-sky-from to-hero-sky-to px-6 py-hero animate-slide-up">
        <div className="max-w-md w-full text-center">
          <Logo size={140} className="mx-auto mb-8" />
          <h1 className="text-[44px] sm:text-hero-display font-semibold leading-[1.05] tracking-[-2px] text-on-dark mb-4">{t("appName")}</h1>
          <p className="text-subtitle text-on-dark/80 mb-10 leading-relaxed">
            {isTelegram ? t("loginSubtitle") : "Open the app in Telegram to get started."}
          </p>
          {clerkAuthError && clerkUser && (
            <div className="mb-6 p-3 bg-brand-error/10 rounded-lg border border-brand-error/20">
              <p className="text-body-sm text-on-dark mb-2">Authentication failed. Please try signing out and back in.</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setClerkAuthError(false); window.location.reload() }} className="btn-on-dark text-sm !py-1.5 !px-4">
                  Retry
                </button>
                <button onClick={async () => { await clerkSignOut(); window.location.reload() }} className="btn-secondary text-sm !py-1.5 !px-4 !text-on-dark !border-on-dark/30">
                  Sign Out
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center justify-center gap-3">
            {!isTelegram && <GoogleSignInButton />}
            <button onClick={doLogin} className="btn-accent-green min-w-[200px]">{isTelegram ? t("loginButton") : "Telegram Login"}</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === "library") {
    const filtered = quizzes.filter(q =>
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.description.toLowerCase().includes(search.toLowerCase())
    )
    const root = filtered.filter(q => q.folderId === null)
    const empty = folders.length === 0 && filtered.length === 0

    return (
      <div key="library" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up">
        <header className="flex items-center justify-between px-6 h-14 hairline-bottom">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <h2 className="text-heading-5">{selectMode ? `${selectedIds.size} ${t("selected")}` : t("library")}</h2>
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <button onClick={clearSelection} className="btn-ghost text-sm !px-3 !py-1.5">{t("cancelSelection")}</button>
            ) : (
              <>
                <span className="text-micro text-brand-green font-semibold tracking-tight">{user.credits} {t("credits")}</span>
                <button onClick={() => setSelectMode(true)} className="btn-ghost text-sm !px-3 !py-1.5">{t("select")}</button>
                <button onClick={() => go("settings")} className="btn-icon"><Settings size={16} /></button>
              </>
            )}
          </div>
        </header>
        <div className={cn("px-6 pt-5 space-y-4", selectMode && selectedIds.size > 0 ? "pb-20" : "pb-6")}>
          <div className="flex gap-2.5">
            <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex-1"><Upload size={16} /> {t("upload")}</button>
            <button onClick={() => setShowAddModal(true)} className="btn-accent-green flex-1"><Plus size={16} /> {t("generate")}</button>
            <input ref={fileInputRef} onChange={handleUpload} type="file" accept=".pdf,application/pdf,.json" className="hidden" />
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
            <input
              value={search} onChange={e => {
                const v = e.target.value
                if (v === "/pathfinder") {
                  setSearch("")
                  setShowAdminPassword(true)
                  setAdminPassword("")
                  setAdminAttempts(0)
                  setAdminError("")
                  return
                }
                setSearch(v)
              }}
              placeholder={t("searchPlaceholder")}
              className="search-pill pl-9"
            />
          </div>
          {empty && (
            <div className="text-center py-16">
              <p className="text-body-md text-steel mb-1">{t("emptyLibrary")}</p>
              <p className="text-caption text-muted">{t("emptyLibraryHint")}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="micro-uppercase text-steel">{t("folders")}</span>
            <button onClick={() => { setShowNewFolderInput(true); setNewFolderName("") }} className="text-micro text-brand-green font-medium cursor-pointer hover:underline">{t("newFolder")}</button>
          </div>
          {showNewFolderInput && (
            <div className="flex gap-2 items-center">
              <input
                value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder={t("folderNamePlaceholder")}
                className="search-pill flex-1"
                onKeyDown={e => { if (e.key === "Enter") addFolder(newFolderName); if (e.key === "Escape") setShowNewFolderInput(false) }}
                autoFocus
              />
              <button onClick={() => addFolder(newFolderName)} className="btn-primary text-sm !px-3 !py-1.5">{t("add")}</button>
              <button onClick={() => setShowNewFolderInput(false)} className="btn-ghost text-sm !px-2 !py-1.5">{t("cancel")}</button>
            </div>
          )}
          {selectMode && (
            <div className="flex items-center gap-2 px-1 py-1.5">
              <button onClick={() => {
                const allIds = new Set<string>()
                folders.forEach(f => allIds.add(f.id))
                filtered.forEach(q => allIds.add(q.id))
                setSelectedIds(prev => prev.size === allIds.size ? new Set() : allIds)
              }} className="flex items-center gap-2 text-body-sm text-steel cursor-pointer">
                <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0", folders.length + filtered.length > 0 && selectedIds.size === folders.length + filtered.length ? "bg-brand-green border-brand-green" : selectedIds.size > 0 ? "bg-brand-green/40 border-brand-green" : "border-steel")}>
                  {selectedIds.size === folders.length + filtered.length && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                Select All
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {folders.map(f => {
              const fq = filtered.filter(q => q.folderId === f.id)
              const open = expandedFolders.has(f.id)
              const hasQuizzes = fq.length > 0
              return (
                <div key={f.id}>
                  <div
                    className="sidebar-item w-full pl-2 group"
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("bg-surface") }}
                    onDragLeave={e => e.currentTarget.classList.remove("bg-surface")}
                    onDrop={e => { e.currentTarget.classList.remove("bg-surface"); handleDrop(e, f.id) }}
                  >
                    {selectMode && (
                      <button onClick={e => { e.stopPropagation(); toggleSelect(f.id) }} className="shrink-0 mr-1.5">
                        <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", selectedIds.has(f.id) ? "bg-brand-green border-brand-green" : "border-steel")}>
                          {selectedIds.has(f.id) && <Check size={10} className="text-white" strokeWidth={3} />}
                        </div>
                      </button>
                    )}
                    <button onClick={() => toggleFolder(f.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {open ? <ChevronDown size={13} className="text-steel shrink-0" /> : <ChevronRight size={13} className="text-steel shrink-0" />}
                      <Folder size={15} className={cn("shrink-0 transition-colors duration-150", open ? "text-brand-green fill-brand-green/15" : hasQuizzes ? "text-steel" : "text-muted")} />
                      {renamingFolderId === f.id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="text-input text-body-sm-medium !py-0.5 flex-1 min-w-0"
                          autoFocus
                          onBlur={() => handleRenameFolder(f.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleRenameFolder(f.id)
                            if (e.key === "Escape") setRenamingFolderId(null)
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={cn("text-body-sm-medium flex-1 min-w-0 truncate cursor-text", hasQuizzes ? "text-ink" : "text-muted")}
                          onDoubleClick={e => { e.stopPropagation(); setRenamingFolderId(f.id); setEditName(f.name) }}
                        >
                          {f.name}
                        </span>
                      )}
                    </button>
                    <span className="text-micro text-muted">{fq.length}</span>
                    {renamingFolderId !== f.id && !selectMode && (
                      <>
                        <button onClick={e => { e.stopPropagation(); setRenamingFolderId(f.id); setEditName(f.name) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename folder">
                          <Edit2 size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteFolder(f.id) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete folder">
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="relative ml-[18px] border-l border-hairline-soft">
                    {open && hasQuizzes && fq.map((q) => (
                      <div
                        key={q.id}
                        draggable={!selectMode}
                        onDragStart={e => handleDragStart(e, q.id)}
                        onClick={() => { if (selectMode) toggleSelect(q.id); else if (!renamingQuizId) openQuiz(q) }}
                        className={cn("sidebar-item group w-full pl-[18px] rounded-none border-l-0 relative", selectMode && "cursor-pointer")}
                      >
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-px bg-hairline-soft" />
                        {selectMode ? (
                          <button onClick={e => { e.stopPropagation(); toggleSelect(q.id) }} className="shrink-0 mr-1">
                            <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", selectedIds.has(q.id) ? "bg-brand-green border-brand-green" : "border-steel")}>
                              {selectedIds.has(q.id) && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                          </button>
                        ) : (
                          <FileText size={14} className="text-steel shrink-0" />
                        )}
                        {renamingQuizId === q.id ? (
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="text-input text-body-sm !py-0.5 flex-1 min-w-0"
                            autoFocus
                            onBlur={() => handleRenameQuiz(q.id)}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleRenameQuiz(q.id)
                              if (e.key === "Escape") setRenamingQuizId(null)
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate flex-1 min-w-0">{q.title}</span>
                        )}
                        {renamingQuizId !== q.id && !selectMode && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setRenamingQuizId(q.id); setEditName(q.title) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteQuiz(q.id) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {root.map(q => (
              <div
                key={q.id}
                draggable={!selectMode}
                onDragStart={e => handleDragStart(e, q.id)}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("bg-surface") }}
                onDragLeave={e => e.currentTarget.classList.remove("bg-surface")}
                onDrop={e => { e.currentTarget.classList.remove("bg-surface"); handleDrop(e, null) }}
                onClick={() => { if (selectMode) toggleSelect(q.id); else if (!renamingQuizId) openQuiz(q) }}
                className={cn("sidebar-item group w-full pl-[26px]", selectMode && "cursor-pointer")}
              >
                {selectMode ? (
                  <button onClick={e => { e.stopPropagation(); toggleSelect(q.id) }} className="shrink-0 mr-1">
                    <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", selectedIds.has(q.id) ? "bg-brand-green border-brand-green" : "border-steel")}>
                      {selectedIds.has(q.id) && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                ) : (
                  <FileText size={14} className="text-steel shrink-0" />
                )}
                {renamingQuizId === q.id ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="text-input text-body-sm !py-0.5 flex-1 min-w-0"
                    autoFocus
                    onBlur={() => handleRenameQuiz(q.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleRenameQuiz(q.id)
                      if (e.key === "Escape") setRenamingQuizId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate flex-1 min-w-0">{q.title}</span>
                )}
                {renamingQuizId !== q.id && !selectMode && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setRenamingQuizId(q.id); setEditName(q.title) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename quiz">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteQuiz(q.id) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete quiz">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          {selectMode && selectedIds.size > 0 && (
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-canvas border-t border-hairline px-6 py-3 flex gap-2.5 z-40">
              <button onClick={() => setShowDeleteConfirm(true)} className="bg-brand-error text-white rounded-full px-5 py-2.5 text-button-md inline-flex items-center justify-center gap-1.5 flex-1 cursor-pointer"><Trash2 size={14} /> {t("deleteSelected")} ({selectedIds.size})</button>
              <button onClick={() => setShowMoveDialog(true)} className="btn-secondary flex-1"><Folder size={14} /> {t("moveTo")}</button>
            </div>
          )}
        </div>
        <AddQuizModal open={showAddModal || !!clarificationQuestion} folders={folders} onAdd={generateWithAI} onAddFolder={addFolder} onClose={() => { setShowAddModal(false); setClarificationQuestion(null); setPendingGeneration(null) }} t={t} generating={generating} clarificationQuestion={clarificationQuestion} onClarify={handleClarify} />
        <UploadModal open={showUploadModal} fileName={pendingFile?.name ?? ""} questionsPerQuiz={uploadQuestionsPerQuiz} onChangeQuestionsPerQuiz={setUploadQuestionsPerQuiz} onConfirm={handleUploadPdf} onClose={() => { setShowUploadModal(false); setPendingFile(null); setUploadProcessing(false); setUploadProgress(""); setUploadLogs([]); setUploadFolderId(null) }} t={t} processing={uploadProcessing} progressLabel={uploadProgress} logs={uploadLogs} folders={folders} folderId={uploadFolderId} onChangeFolder={setUploadFolderId} onAddFolder={addFolder} />
        {showMoveDialog && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-sm w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">{t("moveToFolder")}</p>
              <p className="text-body-sm text-steel mb-4">{selectedIds.size} {t("selected")}</p>
              <div className="space-y-1 mb-5 max-h-48 overflow-y-auto">
                <button onClick={() => { handleBatchMove(null); setShowMoveDialog(false) }} className="w-full text-left sidebar-item">
                  <span className="text-steel">— {t("noFolder")}</span>
                </button>
                {folders.map(f => (
                  <button key={f.id} onClick={() => { handleBatchMove(f.id); setShowMoveDialog(false) }} className="w-full text-left sidebar-item">
                    <Folder size={14} className="text-steel shrink-0" />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowMoveDialog(false)} className="btn-secondary w-full">{t("cancel")}</button>
            </div>
          </div>
        )}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-sm w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">{t("deleteSelectedConfirm")}</p>
              <p className="text-body-sm text-steel mb-4">{t("deleteSelectedWarning")}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">{t("cancel")}</button>
                <button onClick={handleBatchDelete} className="bg-brand-error text-white rounded-full px-5 py-2.5 text-button-md inline-flex items-center justify-center gap-1.5 flex-1 cursor-pointer">{t("deleteSelected")}</button>
              </div>
            </div>
          </div>
        )}
        {showAdminPassword && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-xs w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">Enter admin password</p>
              <p className="text-body-sm text-steel mb-4">{3 - adminAttempts} attempts remaining</p>
              <div className="space-y-3 mb-4">
                <input
                  value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                  type="password"
                  placeholder="••••"
                  className="text-input"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key !== "Enter") return
                    if (adminPassword === "2312") {
                      setShowAdminPassword(false)
                      setAdminError("")
                      go("admin")
                    } else {
                      const newAttempts = adminAttempts + 1
                      setAdminAttempts(newAttempts)
                      setAdminError("Wrong password")
                      setAdminPassword("")
                      if (newAttempts >= 3) {
                        setShowAdminPassword(false)
                        setAdminError("")
                      }
                    }
                  }}
                />
                {adminError && <p className="text-body-sm text-brand-error">{adminError}</p>}
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => { setShowAdminPassword(false); setAdminError("") }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => {
                  if (adminPassword === "2312") {
                    setShowAdminPassword(false)
                    setAdminError("")
                    go("admin")
                  } else {
                    const newAttempts = adminAttempts + 1
                    setAdminAttempts(newAttempts)
                    setAdminError("Wrong password")
                    setAdminPassword("")
                    if (newAttempts >= 3) {
                      setShowAdminPassword(false)
                      setAdminError("")
                    }
                  }
                }} className="btn-primary flex-1">Submit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (screen === "overview" && quiz) {
    return (
      <div key="overview" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up">
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
          <Logo size={28} />
          <h2 className="text-heading-5 truncate">{quiz.title}</h2>
        </header>
        <div className="px-6 py-6 space-y-6">
          <div className="card-base space-y-2">
            {[
              [t("questions"), String(quiz.questionCount)],
              [t("source"), quiz.source],
              [t("created"), quiz.createdAt],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-1.5 border-b border-hairline-soft last:border-0">
                <span className="text-body-sm text-steel">{k}</span>
                <span className="text-body-sm-medium text-ink">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-body-sm text-ink">{t("randomizeQuiz")}</span>
            <button
              onClick={() => setRandomize(!randomize)}
              className={cn("flex items-center px-0.5 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer", randomize ? "bg-brand-green justify-end" : "bg-hairline justify-start")}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          <div className="flex gap-2.5">
            {savedProgress && (
              <button onClick={resumeQuiz} className="btn-accent-green flex-1">Resume ({savedProgress.mode}, Q{savedProgress.currentIdx + 1})</button>
            )}
            <button onClick={startPractice} className={savedProgress ? "btn-secondary flex-1" : "btn-primary flex-1"}>{t("practiceMode")}</button>
            <button onClick={startExam} className="btn-secondary flex-1">{t("examMode")}</button>
          </div>

          <div className="flex gap-2.5">
            <button onClick={() => setShowShareModal(true)} className="btn-ghost flex-1 border border-btn-border"><Share2 size={14} /> {t("share")}</button>
            <button onClick={() => setShowDeleteModal(true)} className="btn-ghost flex-1 border border-btn-border text-brand-error"><Trash2 size={14} /> {t("delete")}</button>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">{t("questions")}</p>
            <div className="space-y-1">
              {allQ.map((q, i) => (
                <div key={q.id} className="sidebar-item">
                  <span className="w-6 h-6 rounded-full bg-surface border border-hairline flex items-center justify-center text-micro shrink-0">{i + 1}</span>
                  <span className="truncate">{q.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showDeleteModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-xs w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">{t("deleteConfirm")}</p>
              <p className="text-body-sm text-steel mb-5">{t("deleteWarning")}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">{t("cancel")}</button>
                <button onClick={() => { setQuizzes(p => p.filter(q => q.id !== quiz.id)); setSelectedQuiz(null); setShowDeleteModal(false); go("library") }} className="flex-1 bg-brand-error text-white rounded-full px-5 py-2.5 text-button-md cursor-pointer">{t("delete")}</button>
              </div>
            </div>
          </div>
        )}

        <ShareModal open={showShareModal} quizId={quiz.id} onClose={() => setShowShareModal(false)} t={t} />
      </div>
    )
  }

  if (screen === "practice") {
    if (!curQ) return null
    const correct = selectedOpt === curQ.correctIndex

    return (
      <div key="practice" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex flex-col animate-slide-up">
        <header className="flex items-center justify-between px-6 h-14 hairline-bottom">
          <button onClick={() => go("overview")} className="btn-icon"><ArrowLeft size={16} /></button>
          <span className="text-caption text-steel">{currentIdx + 1} / {activeQ.length}</span>
          <button onClick={() => go("overview")} className="btn-icon"><X size={16} /></button>
        </header>
        <div className="w-full h-1 bg-surface">
          <div className="h-1 bg-brand-green transition-all duration-300" style={{ width: `${((currentIdx + (showFeedback ? 1 : 0)) / activeQ.length) * 100}%` }} />
        </div>
        <div className="flex-1 px-6 py-6 flex flex-col">
          <p className="text-body-md text-ink mb-6 leading-relaxed">{curQ.text}</p>
          <div className="space-y-2.5 mb-6">
            {curQ.options.map((opt, i) => {
              const sel = selectedOpt === i
              const cor = showFeedback && i === curQ.correctIndex
              const wrg = showFeedback && sel && !cor
              return (
                <button
                  key={i}
                  onClick={() => !showFeedback && answer(i)}
                  disabled={showFeedback}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border text-body-sm transition-all duration-150 cursor-pointer opacity-0 animate-slide-up",
                    cor && "border-brand-green bg-brand-green-soft/20 text-primary",
                    wrg && "border-brand-error bg-brand-error/10 text-brand-error",
                    !showFeedback && sel && "border-primary bg-surface text-ink",
                    !showFeedback && !sel && "border-hairline text-ink hover:bg-surface hover:border-steel",
                    showFeedback && !cor && !wrg && "border-hairline text-steel",
                  )}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {showFeedback && curQ.explanation && (
            <div className="card-base bg-surface mb-6 animate-slide-down">
              <p className="micro-uppercase text-ink mb-1">{t("explanation")}</p>
              <p className="text-body-sm text-steel">{curQ.explanation}</p>
            </div>
          )}
          <div className="mt-auto flex gap-2.5">
            {!showFeedback && (
              <>
                <button onClick={doSkip} className="btn-ghost border border-btn-border">{t("skip")}</button>
                <button onClick={submitAns} disabled={selectedOpt === null} className="btn-primary flex-1">{t("submit")}</button>
              </>
            )}
            {showFeedback && (
              <button onClick={doNext} className="btn-primary flex-1">
                {currentIdx < activeQ.length - 1 ? t("next") : t("seeResults")}
              </button>
            )}
          </div>
          {showFeedback && (
            <div className={cn("flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg animate-slide-down", correct ? "bg-brand-green-soft/20" : "bg-brand-error/10")}>
              {correct ? <Check size={16} className="text-brand-green shrink-0" /> : <X size={16} className="text-brand-error shrink-0" />}
              <span className={cn("text-body-sm-medium", correct ? "text-brand-green-deep" : "text-brand-error")}>
                {correct ? t("correct") : `${t("incorrect")} — ${curQ.options[curQ.correctIndex]}`}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (screen === "exam") {
    if (!curQ) return null

    return (
      <div key="exam" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline flex flex-col animate-slide-up">
        <header className="flex items-center justify-between px-6 h-14 hairline-bottom">
          <div className="flex items-center gap-2 text-body-sm text-steel">
            <Clock size={15} />
            <span className="font-medium tabular-nums">{Math.floor(examTimeLeft / 60)}:{(examTimeLeft % 60).toString().padStart(2, "0")}</span>
          </div>
          <span className="text-caption text-steel">{currentIdx + 1} / {allQ.length}</span>
          <button onClick={finish} className="text-button-md text-brand-error cursor-pointer">{t("submit")}</button>
        </header>
        <div className="flex gap-1.5 px-6 py-3 hairline-bottom overflow-x-auto">
          {allQ.map((q, i) => {
            const isAns = answers[q.id] !== undefined
            const isSkip = skipped.has(q.id)
            return (
              <button
                key={q.id} onClick={() => setCurrentIdx(i)}
                className={cn(
                  "w-7 h-7 rounded-full text-micro flex items-center justify-center shrink-0 transition-colors duration-150 cursor-pointer",
                  i === currentIdx && "ring-2 ring-primary text-ink font-medium",
                  i !== currentIdx && isSkip && "bg-brand-warn/15 text-brand-warn border border-brand-warn",
                  i !== currentIdx && isAns && !isSkip && "bg-brand-green-soft/30 text-brand-green-deep border border-brand-green",
                  i !== currentIdx && !isAns && !isSkip && "bg-surface text-steel border border-hairline",
                )}
              >{i + 1}</button>
            )
          })}
        </div>
        <div className="flex-1 px-6 py-6 flex flex-col">
          <p className="text-body-md text-ink mb-6 leading-relaxed">{curQ.text}</p>
          <div className="space-y-2.5 mb-6">
            {curQ.options.map((opt, i) => {
              const sel = answers[curQ.id] === i
              return (
                <button
                  key={i} onClick={() => answer(i)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border text-body-sm transition-all duration-150 cursor-pointer opacity-0 animate-slide-up",
                    sel ? "border-primary bg-surface text-ink" : "border-hairline text-ink hover:bg-surface hover:border-steel",
                  )}
                >{opt}</button>
              )
            })}
          </div>
          <div className="mt-auto flex gap-2.5">
            <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0} className="btn-ghost border border-btn-border disabled:text-muted disabled:cursor-not-allowed">{t("prev")}</button>
            <button onClick={doSkip} className="btn-ghost border border-btn-border">{t("skip")}</button>
            {currentIdx < allQ.length - 1 ? (
              <button onClick={() => setCurrentIdx(currentIdx + 1)} className="btn-primary flex-1">{t("next")}</button>
            ) : (
              <button onClick={finish} className="btn-primary flex-1">{t("submit")}</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (screen === "results" && results) {
    const pct = Math.round((results.correct / results.total) * 100)

    return (
      <div key="results" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up">
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
          <h2 className="text-heading-5">{t("results")}</h2>
        </header>
        <div className="px-6 py-8 space-y-6">
          <div className="text-center py-6">
            <p className="text-[48px] sm:text-display-lg font-semibold leading-[1.1] tracking-[-1.5px] text-ink">{results.correct}/{results.total}</p>
            <p className={cn("text-heading-4 mt-1", pct >= 70 ? "text-brand-green" : pct >= 40 ? "text-brand-warn" : "text-brand-error")}>{pct}%</p>
            {results.timeTaken !== undefined && (
              <p className="text-body-sm text-muted mt-2">{t("time")}: {Math.floor(results.timeTaken / 60)}{t("minutes")} {results.timeTaken % 60}{t("seconds")}</p>
            )}
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">{t("review")}</p>
            <div className="space-y-1.5">
              {allQ.map((q, i) => {
                const ua = results.answers[q.id]
                const cor = ua === q.correctIndex
                const skip = results.skipped.has(q.id)
                return (
                  <div key={q.id} className={cn("rounded-lg border px-4 py-3", skip ? "border-brand-warn/40 bg-brand-warn/[0.04]" : cor ? "border-brand-green/40 bg-brand-green/[0.04]" : "border-brand-error/40 bg-brand-error/[0.04]")}>
                    <div className="flex items-start gap-2.5">
                      <span className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-semibold border", skip ? "border-brand-warn text-brand-warn" : cor ? "border-brand-green text-brand-green" : "border-brand-error text-brand-error")}>
                        {skip ? "~" : cor ? <Check size={12} /> : <X size={12} />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-body-sm text-ink">{q.text}</p>
                        {!skip && ua !== undefined && (
                          <p className="text-caption text-muted mt-0.5">{t("youPrefix")} {q.options[ua]}</p>
                        )}
                        {(!cor || skip) && (
                          <p className="text-caption text-brand-green mt-0.5">{t("correctPrefix")} {q.options[q.correctIndex]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            {results.correct < results.total && (
              <button onClick={retryIncorrect} className="btn-primary w-full">{t("retryIncorrect")}</button>
            )}
            <button onClick={restart} className="btn-secondary w-full">{t("restartQuiz")}</button>
            <button onClick={() => go("library")} className="btn-ghost w-full text-steel">{t("backToLibrary")}</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === "settings") {
    return (
      <div key="settings" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up">
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
          <Logo size={28} />
          <h2 className="text-heading-5">{t("settings")}</h2>
        </header>
        <div className="px-6 py-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 hairline-bottom">
            <div className="w-10 h-10 rounded-full bg-surface border border-hairline flex items-center justify-center text-body-sm-medium text-ink">{user.displayName[0]}</div>
            <div>
              <p className="text-body-sm-medium text-ink">{user.displayName}</p>
              <p className="text-caption text-muted">@{username || user.username || "set username"}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="micro-uppercase text-steel block mb-1.5">{t("displayName")}</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} onBlur={() => updateSettings({ displayName })} className="text-input" />
            </div>

            <div>
              <label className="micro-uppercase text-steel block mb-1.5">{t("username")}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-body-sm">@</span>
                  <input
                    value={username}
                    onChange={e => { setUsername(e.target.value); setUsernameError(""); setUsernameSaved(false) }}
                    placeholder="username"
                    className={`text-input !pl-8 ${usernameError ? "!border-brand-error" : usernameSaved ? "!border-brand-green" : ""}`}
                  />
                  {usernameChecking && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted">…</span>}
                </div>
                <button
                  onClick={async () => {
                    const val = username.trim().toLowerCase()
                    if (!val) { setUsernameError(""); return }
                    if (!/^[a-z0-9_]{3,20}$/.test(val)) {
                      setUsernameError("3-20 chars, letters, numbers and underscores")
                      return
                    }
                    setUsernameChecking(true)
                    try {
                      const res = await fetch("/api/settings/check-username", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: val }),
                      })
                      const d = await res.json()
                      if (d.available) {
                        setUsernameError("")
                        await updateSettings({ username: val })
                        setUsernameSaved(true)
                        setTimeout(() => setUsernameSaved(false), 2500)
                      } else {
                        setUsernameError(d.message || "Username is taken")
                      }
                    } catch { setUsernameError("Check failed") }
                    setUsernameChecking(false)
                  }}
                  disabled={usernameChecking}
                  className="btn-primary !px-4 !py-2 text-sm shrink-0"
                >
                  {t("save")}
                </button>
              </div>
              {usernameSaved && <p className="text-caption text-brand-green mt-2">Saved!</p>}
              {usernameError && <p className="text-caption text-brand-error mt-2">{usernameError}</p>}
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-body-sm text-ink">{t("darkTheme")}</span>
              <button
                onClick={() => setDarkMode(d => !d)}
                className={cn("flex items-center px-0.5 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer", darkMode ? "bg-brand-green justify-end" : "bg-hairline justify-start")}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div>
              <label className="micro-uppercase text-steel block mb-1.5">{t("language")}</label>
              <select value={language} onChange={e => { setLanguage(e.target.value as Lang); updateSettings({ languageCode: e.target.value }) }} className="text-input !py-[7px]">
                <option value="en">{t("english")}</option>
                <option value="uz">{t("uzbek")}</option>
                <option value="ru">{t("russian")}</option>
              </select>
            </div>

            <div className="card-feature">
              <p className="text-body-sm-medium text-ink">{t("aiCredits")}</p>
              <p className="text-[36px] font-semibold leading-[1.2] tracking-[-0.5px] text-brand-green mt-1">{user.credits}</p>
              <p className="text-caption text-muted">{t("creditsRefresh")}</p>
            </div>

            <button onClick={async () => {
              if (!confirm("Delete your account?")) return
              try {
                await deleteAccount()
                setUser(null)
                setToken(null)
                localStorage.clear()
                window.location.reload()
              } catch (e) {
                console.error("[settings] delete account failed", e)
                alert("Failed to delete account. Please try signing out and back in.")
              }
            }} className="w-full flex items-center justify-center gap-2 text-body-sm text-brand-error py-3 rounded-lg border border-btn-border cursor-pointer hover:bg-surface transition-colors duration-150">
              <Trash2 size={14} /> {t("deleteAccount")}
            </button>

            <div className="border-t border-hairline pt-4">
            <button onClick={async () => {
              await clerkSignOut().catch(() => {})
              setUser(null)
              setToken(null)
              localStorage.clear()
              window.location.reload()
            }} className="w-full flex items-center justify-center gap-2 text-body-sm text-steel py-2 cursor-pointer hover:text-ink transition-colors duration-150">
              <LogOut size={14} /> {t("loggedInAsAt")}{user.username}
            </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (screen === "admin") {
    function setField(key: string, val: string) {
      setDirty(p => ({ ...p, [key]: val }))
      setSaved(false)
    }

    async function saveConfig() {
      setSaving(true)
      try {
        const res = await fetch("/api/admin/config", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "2312", ...dirty }),
        })
        if (res.ok) {
          setSaved(true)
          setCfg(p => p ? { ...p, ...dirty } : p)
          setDirty({})
        }
      } catch {}
      setSaving(false)
    }

    return (
      <div key="admin" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up" style={{ paddingBottom: "100px" }}>
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
          <Logo size={28} />
          <h2 className="text-heading-5">Admin Panel</h2>
        </header>
        <div className="px-6 py-6 space-y-8">

          <div>
            <p className="micro-uppercase text-steel mb-3">Configuration</p>
            <div className="card-base p-4 space-y-4">
              <div>
                <label className="text-body-sm font-medium text-ink block mb-1">TELEGRAM_BOT_TOKEN</label>
                <input value={dirty["TELEGRAM_BOT_TOKEN"] ?? cfg?.TELEGRAM_BOT_TOKEN ?? ""} onChange={e => setField("TELEGRAM_BOT_TOKEN", e.target.value)} className="text-input font-mono text-sm" placeholder="Telegram bot token" />
              </div>
              <div>
                <label className="text-body-sm font-medium text-ink block mb-1">APP_URL</label>
                <input value={dirty["APP_URL"] ?? cfg?.APP_URL ?? ""} onChange={e => setField("APP_URL", e.target.value)} className="text-input text-sm" placeholder="https://yourdomain.com" />
              </div>
              <div>
                <label className="text-body-sm font-medium text-ink block mb-1">Fallback API Keys</label>
                {(() => {
                  const raw = dirty["OPENROUTER_API_KEYS"] ?? cfg?.OPENROUTER_API_KEYS ?? ""
                  const keys = raw ? raw.split(",") : [""]
                  return keys.map((k, i) => {
                    const st = keyTestStatus.current[i] ?? { testing: false, result: "" }
                    return (
                      <div key={`ak-${k || i}-${i}`} className="mb-2">
                        <div className="flex gap-2">
                          <input value={k} onChange={e => {
                            const updated = [...keys]
                            updated[i] = e.target.value
                            setField("OPENROUTER_API_KEYS", updated.join(","))
                            keyTestStatus.current[i] = { testing: false, result: "" }; forceRender(n => n + 1)
                          }} className="text-input font-mono text-sm flex-1" placeholder={`sk-or-... (key ${i + 1})`} />
                          <span onClick={e => {
                            e.preventDefault()
                            const keyVal = k.trim()
                            if (!keyVal || st.testing) return
                            const idx = i
                            keyTestStatus.current[idx] = { testing: true, result: "" }; forceRender(n => n + 1)
                            fetch("/api/admin/test-key", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password: "2312", key: keyVal }),
                            }).then(r => r.json()).then(d => {
                              const info = d.data
                              if (info?.valid) {
                                const c = info.credits != null ? ` — $${info.credits.toFixed(4)}` : ""
                                keyTestStatus.current[idx] = { testing: false, result: `✅ Valid${c}` }; forceRender(n => n + 1)
                              } else {
                                keyTestStatus.current[idx] = { testing: false, result: `❌ ${info?.error || "Invalid"}` }; forceRender(n => n + 1)
                              }
                            }).catch(() => {
                              keyTestStatus.current[idx] = { testing: false, result: "❌ Request failed" }; forceRender(n => n + 1)
                            })
                          }} className={cn("inline-flex items-center justify-center cursor-pointer select-none text-sm !px-2 !py-1 border border-btn-border rounded-md transition-colors duration-150", st.testing ? "opacity-40 pointer-events-none" : "hover:bg-surface")}>
                            {st.testing ? "..." : "Test"}
                          </span>
                          <button type="button" onClick={() => {
                            const updated = keys.filter((_, j) => j !== i)
                            setField("OPENROUTER_API_KEYS", updated.join(","))
                          }} className="text-caption text-brand-error hover:underline shrink-0">Remove</button>
                        </div>
                        {st.result && (
                          <p className={cn("text-caption mt-0.5", st.result.startsWith("✅") ? "text-brand-green" : "text-brand-error")}>{st.result}</p>
                        )}
                      </div>
                    )
                  })
                })()}
                <button onClick={() => {
                  const current = dirty["OPENROUTER_API_KEYS"] ?? cfg?.OPENROUTER_API_KEYS ?? ""
                  setField("OPENROUTER_API_KEYS", current ? current + "," : "")
                }} className="text-caption text-brand-blue hover:underline">+ Add key</button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={saveConfig} disabled={saving || Object.keys(dirty).length === 0} className="btn-primary text-sm !py-1.5">
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
                {saved && <span className="text-caption text-brand-green">Saved!</span>}
              </div>
            </div>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">Telegram Bot</p>
            <div className="card-base p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-ink">Status</span>
                <span className={cn("text-caption font-medium px-2.5 py-0.5 rounded-full", botStatus === "running" ? "bg-brand-green-soft/20 text-brand-green-deep" : botStatus === "checking" ? "bg-surface text-muted border border-hairline" : "bg-brand-error/10 text-brand-error")}>
                  {botStatus === "running" ? "Running" : botStatus === "checking" ? "Checking..." : "Stopped"}
                </span>
              </div>
              <div className="flex gap-2">
                {botStatus !== "running" ? (
                  <button onClick={async () => {
                    setBotStatus("checking")
                    const res = await fetch("/api/admin/bot", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password: "2312", action: "start" }),
                    })
                    const d = await res.json()
                    setBotStatus(d.data?.status === "started" ? "running" : "stopped")
                  }} className="btn-primary flex-1 text-sm !py-1.5">Start Bot</button>
                ) : (
                  <button onClick={async () => {
                    const res = await fetch("/api/admin/bot", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password: "2312", action: "stop" }),
                    })
                    const d = await res.json()
                    setBotStatus(d.data?.status === "stopped" ? "stopped" : "running")
                  }} className="btn-ghost border border-btn-border flex-1 text-sm !py-1.5">Stop Bot</button>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">Users</p>
            <div className="card-base p-4 space-y-3">
              <div className="flex gap-2">
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="text-input text-sm flex-1">
                  <option value="">Select a user…</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.displayName}{u.telegramUsername ? ` (@${u.telegramUsername})` : ""} — {u.tokens} tokens</option>
                  ))}
                </select>
                <button onClick={loadUsers} className="btn-ghost border border-btn-border text-sm !px-3 !py-1.5" title="Refresh">↻</button>
              </div>
              {selectedUserId && (() => {
                const selected = allUsers.find(u => u.id === selectedUserId)
                return (
                  <div className="space-y-3">
                    {selected && (
                      <p className="text-body-sm text-ink">Tokens: <span className="font-semibold">{selected.tokens}</span></p>
                    )}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-caption text-steel block mb-0.5">Adjust credits (positive to add, negative to subtract)</label>
                        <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} className="text-input text-sm" placeholder="e.g. 50 or -20" />
                      </div>
                      <button onClick={async () => {
                        const amt = parseInt(creditAmount)
                        if (!amt || amt === 0) return
                        setCreditMsg("Updating...")
                        try {
                          const res = await fetch("/api/admin/users", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ password: "2312", userId: selectedUserId, credits: amt }),
                          })
                          const d = await res.json()
                          if (d.data) {
                            setCreditMsg(amt > 0 ? `Added ${amt} credits!` : `Subtracted ${Math.abs(amt)} credits`)
                            setCreditAmount("")
                            loadUsers()
                            setTimeout(() => setCreditMsg(""), 3000)
                          } else {
                            setCreditMsg("Failed")
                          }
                        } catch { setCreditMsg("Error") }
                      }} disabled={!creditAmount || parseInt(creditAmount) === 0} className="btn-primary text-sm !py-1.5">{parseInt(creditAmount) > 0 ? "Add" : parseInt(creditAmount) < 0 ? "Subtract" : "Update"}</button>
                    </div>
                    {creditMsg && <p className="text-caption text-brand-green">{creditMsg}</p>}
                  </div>
                )
              })()}
            </div>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">Danger Zone</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/admin/kill", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: "2312" }),
                  })
                  if (res.ok) setSiteKilled(true)
                } catch {}
                setSiteKilled(true)
              }}
              className="btn-ghost-danger w-full text-body-sm"
            >
              <Trash2 size={14} /> Kill Site
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const QUESTION_COUNTS = [3, 5, 10, 15, 20]

function AddQuizModal({ open, folders, onAdd, onAddFolder, onClose, t, generating, clarificationQuestion, onClarify }: {
  open: boolean; folders: Folder[]; onAdd: (title: string, description: string, folderId: string | null, questionCount?: number) => void
  onAddFolder: (name: string) => void | Promise<string>; onClose: () => void; t: (key: string) => string; generating?: boolean
  clarificationQuestion?: string | null; onClarify?: (answer: string) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questionCount, setQuestionCount] = useState(5)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [clarifyAnswer, setClarifyAnswer] = useState("")

  if (!open) return null

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === "__new__") { setShowNewFolder(true); return }
    setFolderId(val || null)
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const id = await onAddFolder(newFolderName.trim())
    if (id) setFolderId(id)
    setShowNewFolder(false)
    setNewFolderName("")
  }

  if (clarificationQuestion) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="card-base max-w-sm w-full p-6 animate-scale-in">
          <p className="text-body-md-medium text-ink mb-1">Clarification Needed</p>
          <p className="text-body-sm text-steel mb-4">{clarificationQuestion}</p>
          <div className="space-y-3 mb-5">
            <input value={clarifyAnswer} onChange={e => setClarifyAnswer(e.target.value)} placeholder="Your answer…" className="text-input" autoFocus onKeyDown={e => { if (e.key === "Enter" && clarifyAnswer.trim()) onClarify?.(clarifyAnswer.trim()) }} />
          </div>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="btn-secondary flex-1">{t("cancel")}</button>
            <button onClick={() => onClarify?.(clarifyAnswer.trim())} disabled={!clarifyAnswer.trim()} className="btn-primary flex-1">Submit</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="card-base max-w-sm w-full p-6 animate-scale-in">
        <p className="text-body-md-medium text-ink mb-1">{t("newQuiz")}</p>
        <p className="text-body-sm text-steel mb-4">{t("newQuizHint")}</p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">{t("title")}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} className="text-input" />
          </div>
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">{t("description")}</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} className="text-input" />
          </div>
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">Questions</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={200}
                value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
                list="question-counts"
                className="text-input text-body-sm"
              />
              <datalist id="question-counts">
                {QUESTION_COUNTS.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">{t("folder")}</label>
            {showNewFolder ? (
              <div className="flex gap-2">
                <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder={t("newFolderPlaceholder")} className="text-input flex-1" autoFocus onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false) }} />
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="btn-primary !px-3 !py-1.5 text-sm">{t("add")}</button>
              </div>
            ) : (
              <div className="relative">
                <select value={folderId ?? ""} onChange={handleSelect} className="text-input text-body-sm text-ink appearance-none !pr-8 !py-[7px]">
                  <option value="">{t("noFolder")}</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  <option value="__new__">{t("newFolderOption")}</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steel pointer-events-none" />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={onClose} disabled={generating} className={cn("btn-secondary flex-1", generating && "opacity-40 cursor-not-allowed")}>{t("cancel")}</button>
          <button onClick={() => { if (title.trim()) onAdd(title.trim(), description.trim(), folderId, questionCount) }} disabled={!title.trim() || generating} className="btn-primary flex-1">
            {generating ? <span className="flex items-center gap-1.5"><Loader size="md" variant="spin" /> Generating…</span> : t("create")}
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadModal({ open, fileName, questionsPerQuiz, onChangeQuestionsPerQuiz, onConfirm, onClose, t, processing, progressLabel, logs, folders, folderId, onChangeFolder, onAddFolder }: {
  open: boolean; fileName: string; questionsPerQuiz: number; onChangeQuestionsPerQuiz: (v: number) => void
  onConfirm: () => void; onClose: () => void; t: (key: string) => string
  processing?: boolean; progressLabel?: string; logs?: string[]
  folders: Folder[]; folderId: string | null; onChangeFolder: (v: string | null) => void; onAddFolder: (name: string) => void | Promise<string>
}) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === "__new__") { setShowNewFolder(true); return }
    onChangeFolder(val || null)
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const id = await onAddFolder(newFolderName.trim())
    if (id) onChangeFolder(id)
    setShowNewFolder(false)
    setNewFolderName("")
  }
  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])
  if (!open) return null
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="card-base max-w-sm w-full p-6 animate-scale-in">
        <p className="text-body-md-medium text-ink mb-1">{t("upload")} PDF</p>
        <p className="text-body-sm text-steel mb-4 truncate">{fileName}</p>
        {processing ? (
          <div className="space-y-3">
            <div className="w-full bg-hairline rounded-full h-2 overflow-hidden">
              <div className="bg-brand-green h-full rounded-full animate-progress-bar" />
            </div>
            <div className="bg-canvas border border-hairline rounded-lg max-h-48 overflow-y-auto text-xs font-mono p-2 space-y-0.5">
              {(logs ?? []).map((msg, i) => (
                <div key={i} className={`leading-relaxed ${msg.startsWith("✓") ? "text-brand-green" : msg.startsWith("✗") ? "text-brand-error" : msg.startsWith("⚠") ? "text-amber-500" : "text-steel"}`}>
                  {msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            <div className="text-body-sm text-steel text-center flex items-center justify-center gap-2"><Loader size="md" variant="spin" /> {progressLabel}</div>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-body-sm font-medium text-ink block mb-1.5">{t("questions_per_quiz")}</label>
                <input type="number" min={1} max={200} value={questionsPerQuiz}
                  onChange={e => onChangeQuestionsPerQuiz(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-input" />
              </div>
              <div>
                <label className="text-body-sm font-medium text-ink block mb-1.5">{t("folder")}</label>
                {showNewFolder ? (
                  <div className="flex gap-2">
                    <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder={t("newFolderPlaceholder")} className="text-input flex-1" autoFocus onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false) }} />
                    <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="btn-primary !px-3 !py-1.5 text-sm">{t("add")}</button>
                  </div>
                ) : (
                  <div className="relative">
                    <select value={folderId ?? ""} onChange={handleSelect} className="text-input text-body-sm text-ink appearance-none !pr-8 !py-[7px]">
                      <option value="">{t("noFolder")}</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      <option value="__new__">{t("newFolderOption")}</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steel pointer-events-none" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={onClose} className="btn-secondary flex-1">{t("cancel")}</button>
              <button onClick={onConfirm} className="btn-primary flex-1">{t("upload")} &amp; Parse</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ShareModal({ open, quizId, onClose, t }: { open: boolean; quizId: string; onClose: () => void; t: (key: string) => string }) {
  const [link, setLink] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      generateShareLink(quizId).then(result => {
        const url = `${window.location.origin}/shared/${result.data.token}`
        setLink(url)
        navigator.clipboard?.writeText(url).catch(() => {})
        setCopied(true)
      }).catch(() => {
        setLink(`${window.location.origin}/shared/${quizId}`)
      })
    } else {
      setCopied(false)
      setLink("")
    }
  }, [open, quizId])

  if (!open) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="card-base max-w-sm w-full p-6 animate-scale-in">
        <p className="text-body-md-medium text-ink mb-1">{t("shareQuiz")}</p>
        <p className="text-body-sm text-steel mb-4">{t("shareHint")}</p>
        <div className="flex items-center gap-2 mb-4">
          <input readOnly value={link} className="text-input text-body-sm truncate" />
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => { navigator.clipboard?.writeText(link); setCopied(true) }}
            className={cn("flex-1 rounded-full px-5 py-2.5 text-button-md cursor-pointer transition-all duration-200", copied ? "bg-brand-green text-primary scale-[0.97]" : "bg-primary text-on-primary")}
          >
            {copied ? t("copied") : t("copyLink")}
          </button>
          <button onClick={onClose} className="btn-secondary">{t("close")}</button>
        </div>
      </div>
    </div>
  )
}

export default App

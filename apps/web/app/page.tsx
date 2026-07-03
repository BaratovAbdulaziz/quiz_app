"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { ArrowLeft, Check, ChevronDown, ChevronRight, Clock, FileText, Folder, LogOut, Plus, Search, Settings, Share2, Trash2, Upload, X } from "lucide-react"
import Logo from "./Logo"
import en from "@/i18n/en.json"
import uz from "@/i18n/uz.json"
import ru from "@/i18n/ru.json"
import {
  setToken, loginWithTelegram, fetchMe, fetchQuizzes, fetchQuiz,
  fetchFolders, createFolder, startSession, submitAnswer, skipQuestion,
  completeSession, generateShareLink, updateSettings, deleteAccount,
} from "@/lib/api-client"

type Screen = "login" | "library" | "overview" | "practice" | "exam" | "results" | "settings"

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
  quizIds: string[]
}

interface UserInfo {
  id: string
  telegramId: number
  username: string | null
  displayName: string
  photoUrl: string | null
  languageCode: string
  credits: number
  creditsRefreshAt: string
}

type SessionInfo = {
  id: string
  mode: "practice" | "exam"
  currentQuestionIndex: number
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
  const [retryIds, setRetryIds] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [randomize, setRandomize] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [language, setLanguage] = useState<Lang>("en")
  const [darkMode, setDarkMode] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionMode, setSessionMode] = useState<"practice" | "exam">("practice")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    async function init() {
      const token = localStorage.getItem("access_token")
      if (token) {
        setToken(token)
        try {
          const me = await fetchMe()
          setUser(me.data)
          setDisplayName(me.data.displayName)
          setLanguage((me.data.languageCode as Lang) || "en")
          await loadLibrary()
          setScreen("library")
        } catch {
          setToken(null)
          tryTelegramLogin()
        }
      } else {
        tryTelegramLogin()
      }
      setLoading(false)
    }
    init()
  }, [])

  async function tryTelegramLogin() {
    try {
      const tg = (window as any).Telegram?.WebApp
      if (tg?.initData) {
        const result = await loginWithTelegram(tg.initData)
        setToken(result.data.accessToken)
        localStorage.setItem("refresh_token", result.data.refreshToken)
        setUser(result.data.user)
        setDisplayName(result.data.user.displayName)
        setLanguage((result.data.user.languageCode as Lang) || "en")
        await loadLibrary()
        setScreen("library")
      }
    } catch {
      // User stays on login screen
    }
  }

  async function loadLibrary() {
    try {
      const [qRes, fRes] = await Promise.all([
        fetchQuizzes(),
        fetchFolders(),
      ])
      setQuizzes((qRes.data ?? []) as unknown as Quiz[])
      setFolders((fRes.data ?? []) as unknown as Folder[])
    } catch {
      // silent
    }
  }

  const quiz = selectedQuiz
  const allQ = quiz?.questions ?? []
  const curQ = allQ[currentIdx]
  const isExam = screen === "exam"
  const activeQ = retryIds.size > 0 ? allQ.filter(q => retryIds.has(q.id)) : allQ

  function go(s: Screen) { setScreen(s) }

  async function doLogin() {
    await tryTelegramLogin()
  }

  function openQuiz(q: Quiz) {
    setSelectedQuiz(q); setCurrentIdx(0); setAnswers({}); setSubmitted(new Set())
    setSkipped(new Set()); setShowFeedback(false); setSelectedOpt(null); setResults(null); setRetryIds(new Set())
    go("overview")
  }

  async function startPractice() {
    if (!quiz) return
    try {
      const result = await startSession(quiz.id, "practice")
      const sData = result.data as SessionInfo
      setSessionId(sData.id)
      setSessionMode("practice")
      setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
      setShowFeedback(false); setSelectedOpt(null); go("practice")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start practice")
    }
  }

  async function startExam() {
    if (!quiz) return
    try {
      const result = await startSession(quiz.id, "exam")
      const sData = result.data as SessionInfo
      setSessionId(sData.id)
      setSessionMode("exam")
      setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
      setShowFeedback(false); setSelectedOpt(null); setExamTimeLeft(allQ.length * 60); go("exam")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start exam")
    }
  }

  function answer(i: number) {
    isExam ? setAnswers(p => ({ ...p, [curQ.id]: i })) : setSelectedOpt(i)
  }

  function submitAns() {
    if (selectedOpt === null) return
    setAnswers(p => ({ ...p, [curQ.id]: selectedOpt }))
    setSubmitted(p => new Set(p).add(curQ.id)); setShowFeedback(true)
  }

  async function doSkip() {
    setSkipped(p => new Set(p).add(curQ.id))
    setSubmitted(p => new Set(p).add(curQ.id))
    if (sessionId) {
      try { await skipQuestion(sessionId, curQ.id) } catch {}
    }
    if (currentIdx < activeQ.length - 1) setCurrentIdx(i => i + 1)
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
    setResults({ correct, total: activeQ.length, timeTaken: isExam ? allQ.length * 60 - examTimeLeft : undefined, answers, skipped })
    go("results")
  }

  function retryIncorrect() {
    const ids = new Set<string>()
    for (const q of activeQ) { if (answers[q.id] !== q.correctIndex) ids.add(q.id) }
    if (!ids.size) return
    setRetryIds(ids); setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
    setShowFeedback(false); setSelectedOpt(null); go("practice")
  }

  function restart() {
    setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
    setShowFeedback(false); setSelectedOpt(null); setRetryIds(new Set()); go("overview")
  }

  async function addFolder(name: string) {
    if (!name.trim()) return ""
    try {
      const result = await createFolder(name.trim())
      const f = result.data as unknown as Folder
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

  async function generateWithAI(title: string, description: string, folderId: string | null) {
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ topic: title, description, folderId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: "Failed to generate" } }))
        throw new Error(err.error?.message || "Generation failed")
      }
      const data = await res.json()
      const quiz = data.data as Quiz
      setQuizzes(p => [...p, quiz])
      setShowAddModal(false)
      setGenerating(false)
      openQuiz(quiz)
    } catch (err) {
      setGenerating(false)
      alert(err instanceof Error ? err.message : "Failed to generate quiz")
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (file.size > MAX_UPLOAD_SIZE) {
      alert("File too large (max 50MB)")
      return
    }

    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const buf = await readFileAsBuffer(file)
        const pdf = String.fromCharCode(...new Uint8Array(buf, 0, 5))
        if (pdf !== "%PDF-") { alert("Invalid PDF"); return }

        const text = await readFileAsText(file)
        const formData = new FormData()
        formData.append("file", file)
        const uploadRes = await fetch("/api/files/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
          body: formData,
        })
        if (!uploadRes.ok) throw new Error("Upload failed")
        const uploadData = await uploadRes.json()

        const parseRes = await fetch("/api/ai/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
          body: JSON.stringify({ fileId: uploadData.data.id }),
        })
        if (!parseRes.ok) throw new Error("Parse failed")
        const parseData = await parseRes.json()
        const q = parseData.data as Quiz
        setQuizzes(p => [...p, q])
        openQuiz(q)
      } else {
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
      }
    } catch {
      alert("Invalid file — expected PDF or JSON quiz file")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div key="login" className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-hero-sky-from to-hero-sky-to px-6 py-hero animate-slide-up">
        <div className="max-w-md w-full text-center">
          <Logo size={64} className="mx-auto mb-6" />
          <h1 className="text-[44px] sm:text-hero-display font-semibold leading-[1.05] tracking-[-2px] text-on-dark mb-4">{t("appName")}</h1>
          <p className="text-subtitle text-on-dark/80 mb-10 leading-relaxed">
            {t("loginSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={doLogin} className="btn-accent-green min-w-[200px]">{t("loginButton")}</button>
            <button className="btn-secondary border-on-dark/20 text-on-dark min-w-[140px]">{t("learnMore")}</button>
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
            <Logo size={20} />
            <h2 className="text-heading-5">{t("library")}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-micro text-brand-green font-semibold tracking-tight">{user.credits} {t("credits")}</span>
            <button onClick={() => go("settings")} className="btn-icon"><Settings size={16} /></button>
          </div>
        </header>
        <div className="px-6 pt-5 pb-6 space-y-4">
          <div className="flex gap-2.5">
            <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex-1"><Upload size={16} /> {t("upload")}</button>
            <button onClick={() => setShowAddModal(true)} className="btn-accent-green flex-1"><Plus size={16} /> {t("generate")}</button>
            <input ref={fileInputRef} onChange={handleUpload} type="file" accept=".pdf,application/pdf,.json" className="hidden" />
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
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
          <div className="space-y-0.5">
            {folders.map(f => {
              const fq = filtered.filter(q => q.folderId === f.id)
              if (!fq.length) return null
              const open = expandedFolders.has(f.id)
              return (
                <div key={f.id}>
                  <button onClick={() => toggleFolder(f.id)} className="sidebar-item w-full pl-2 group">
                    {open ? <ChevronDown size={13} className="text-steel shrink-0" /> : <ChevronRight size={13} className="text-steel shrink-0" />}
                    <Folder size={15} className={cn("shrink-0 transition-colors duration-150", open ? "text-brand-green fill-brand-green/15" : "text-steel")} />
                    <span className="text-body-sm-medium text-ink">{f.name}</span>
                    <span className="text-micro text-muted ml-auto">{fq.length}</span>
                  </button>
                  <div className="relative ml-[18px] border-l border-hairline-soft">
                    {open && fq.map((q) => (
                      <button key={q.id} onClick={() => openQuiz(q)} className="sidebar-item w-full pl-[18px] rounded-none border-l-0 relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-px bg-hairline-soft" />
                        <FileText size={14} className="text-steel shrink-0" />
                        <span className="truncate">{q.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {root.map(q => (
              <button key={q.id} onClick={() => openQuiz(q)} className="sidebar-item w-full pl-[26px]">
                <FileText size={14} className="text-steel shrink-0" />
                <span className="truncate">{q.title}</span>
              </button>
            ))}
          </div>
        </div>
        <AddQuizModal open={showAddModal} folders={folders} onAdd={generateWithAI} onAddFolder={addFolder} onClose={() => setShowAddModal(false)} t={t} generating={generating} />
      </div>
    )
  }

  if (screen === "overview" && quiz) {
    return (
      <div key="overview" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up">
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
          <Logo size={20} />
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
            <button onClick={startPractice} className="btn-primary flex-1">{t("practiceMode")}</button>
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
          <Logo size={20} />
          <h2 className="text-heading-5">{t("settings")}</h2>
        </header>
        <div className="px-6 py-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 hairline-bottom">
            <div className="w-10 h-10 rounded-full bg-surface border border-hairline flex items-center justify-center text-body-sm-medium text-ink">{user.displayName[0]}</div>
            <div>
              <p className="text-body-sm-medium text-ink">{user.displayName}</p>
              <p className="text-caption text-muted">@{user.username}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="micro-uppercase text-steel block mb-1.5">{t("displayName")}</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} onBlur={() => updateSettings({ displayName })} className="text-input" />
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

            <button onClick={async () => { if (confirm("Delete your account?")) try { await deleteAccount(); setUser(null); setToken(null); localStorage.clear(); go("login") } catch {} }} className="w-full flex items-center justify-center gap-2 text-body-sm text-brand-error py-3 rounded-lg border border-btn-border cursor-pointer hover:bg-surface transition-colors duration-150">
              <Trash2 size={14} /> {t("deleteAccount")}
            </button>

            <div className="border-t border-hairline pt-4">
              <button onClick={() => { setUser(null); setToken(null); localStorage.clear(); go("login") }} className="w-full flex items-center justify-center gap-2 text-body-sm text-steel py-2 cursor-pointer hover:text-ink transition-colors duration-150">
                <LogOut size={14} /> {t("loggedInAsAt")}{user.username}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function AddQuizModal({ open, folders, onAdd, onAddFolder, onClose, t, generating }: {
  open: boolean; folders: Folder[]; onAdd: (title: string, description: string, folderId: string | null) => void
  onAddFolder: (name: string) => void | Promise<string>; onClose: () => void; t: (key: string) => string; generating?: boolean
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [folderId, setFolderId] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

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
          <button onClick={() => { if (title.trim()) onAdd(title.trim(), description.trim(), folderId) }} disabled={!title.trim() || generating} className="btn-primary flex-1">
            {generating ? <span className="flex items-center gap-1.5">Generating…</span> : t("create")}
          </button>
        </div>
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
        const url = result.data.url
        setLink(url)
        navigator.clipboard?.writeText(url).catch(() => {})
        setCopied(true)
      }).catch(() => {
        setLink(window.location.origin + "/share/" + quizId)
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

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader } from "@/components/ui/loader"
import { cn } from "@/lib/utils"
import { ArrowLeft, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Edit2, Eye, EyeOff, FileText, Flag, Folder, Globe, GripVertical, Grid3x3, ImagePlus, Import, Languages, LogOut, MoreVertical, Plus, Presentation, RotateCcw, Search, Settings, Share2, Sparkles, Trash2, Upload, User, X, Download } from "lucide-react"
import { FluidDropdown, type FluidDropdownItem } from "@/components/ui/fluid-dropdown"
import { parseCrosswordInput, generateCrosswordGrid } from "@/lib/crossword-generator"
import Logo from "./Logo"
import en from "@/i18n/en.json"
import uz from "@/i18n/uz.json"
import ru from "@/i18n/ru.json"
import { useCurrentUser, useFolders, useQuizzes, useSessions, useShare, useAi, useReports, useCrosswords, usePresentations } from "@/lib/api-convex"
import { api } from "@/convex/_generated/api"
import { useQuery, useMutation, useAction } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel"
import { presentationTemplates, getTemplateById } from "@/lib/presentation-templates"
import {
  setToken, setClerkTokenGetter, loginWithTelegram, loginWithClerk, updateSettings,
} from "@/lib/api-client"
import { useUser, useAuth, useClerk } from "@clerk/nextjs"
import GoogleSignInButton from "@/components/auth/GoogleSignInButton"

type Screen = "login" | "library" | "overview" | "practice" | "exam" | "results" | "settings" | "admin" | "trash" | "crossword" | "presentation"

interface Question {
  id: string
  text: string
  options: string[]
  correctIndex: number
  explanation?: string
}

interface Quiz {
  id: string
  userId?: string
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

const languageItems: FluidDropdownItem[] = [
  { id: "en", label: "English", icon: Languages, color: "#4ECDC4" },
  { id: "uz", label: "O'zbek", icon: Languages, color: "#FF6B6B" },
  { id: "ru", label: "Русский", icon: Languages, color: "#45B7D1" },
]

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

  // Convex hooks
  const { convexUser, convexUserId, isLoading: convexAuthLoading } = useCurrentUser()
  const { quizzes: convexQuizzes, trashQuizzes: convexTrashQuizzes, createQuiz: createCvxQuiz, updateQuiz: updateCvxQuiz, deleteQuiz: deleteCvxQuiz, batchDeleteQuizzes: batchDeleteCvxQuizzes, batchMoveQuizzes: batchMoveCvxQuizzes, restoreQuizzes: restoreCvxQuizzes, permanentDeleteQuizzes: permanentDeleteCvxQuizzes } = useQuizzes(convexUserId ?? undefined)
  const { folders: convexFolders, trashFolders: convexTrashFolders, createFolder: createCvxFolder, renameFolder: renameCvxFolder, deleteFolder: deleteCvxFolder, batchDeleteFolders: batchDeleteCvxFolders, restoreFolders: restoreCvxFolders, permanentDeleteFolders: permanentDeleteCvxFolders } = useFolders(convexUserId ?? undefined)
  const { startSession: startCvxSession, submitAnswer: submitCvxAnswer, skipQuestion: skipCvxQuestion, completeSession: completeCvxSession } = useSessions(convexUserId ?? undefined)
  const { generateShareLink: generateCvxShareLink, generateCrosswordShareLink: generateCvxCrosswordShareLink, importQuiz: importCvxQuiz, recordAttempt: recordCvxAttempt } = useShare()
  const { crosswords: convexCrosswords, trashCrosswords: convexTrashCrosswords, createCrossword: createCvxCrossword, updateCrossword: updateCvxCrossword, deleteCrossword: deleteCvxCrossword, batchDeleteCrosswords: batchDeleteCvxCrosswords, batchMoveCrosswords: batchMoveCvxCrosswords, restoreCrosswords: restoreCvxCrosswords, permanentDeleteCrosswords: permanentDeleteCvxCrosswords } = useCrosswords(convexUserId as Id<"users"> | undefined)
  const { presentations: convexPresentations, trashPresentations: convexTrashPresentations, createPresentation: createCvxPresentation, updatePresentation: updateCvxPresentation, updateSlideImage: updateCvxSlideImage, updateSlide: updateCvxSlide, reorderSlides: reorderCvxSlides, addSlide: addCvxSlide, deleteSlide: deleteCvxSlide, deletePresentation: deleteCvxPresentation, batchDeletePresentations: batchDeleteCvxPresentations, batchMovePresentations: batchMoveCvxPresentations, restorePresentations: restoreCvxPresentations, permanentDeletePresentations: permanentDeleteCvxPresentations } = usePresentations(convexUserId as Id<"users"> | undefined)
  const { generateQuiz: generateCvxQuiz, generateCrossword: generateCvxCrossword, generatePresentation: generateCvxPresentation } = useAi()
  const { reportQuestion } = useReports()
  const updateSettingsCvx = useMutation(api.users.updateSettings)
  const deleteAccountCvx = useMutation(api.users.deleteAccount)
  const adjustCreditsByClerkIdCvx = useMutation(api.users.adjustCreditsByClerkId)
  const [screen, setScreen] = useState<Screen>("login")
  const [user, setUser] = useState<UserInfo | null>(null)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null)
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
  const [showCrosswordShareModal, setShowCrosswordShareModal] = useState(false)
  const [showQuizTeachersKey, setShowQuizTeachersKey] = useState(false)
  const [showTeachersMode, setShowTeachersMode] = useState(false)
  const [teachersModeQuizId, setTeachersModeQuizId] = useState<string | null>(null)
  const [teachersModeCrosswordId, setTeachersModeCrosswordId] = useState<Id<"crosswords"> | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [showQuizTypeModal, setShowQuizTypeModal] = useState(false)
  const [showCrosswordTypeModal, setShowCrosswordTypeModal] = useState(false)
  const [showCrosswordAddModal, setShowCrosswordAddModal] = useState(false)
  const [showCrosswordManualModal, setShowCrosswordManualModal] = useState(false)
  const [showCrosswordPasteModal, setShowCrosswordPasteModal] = useState(false)
  const [generatingCrossword, setGeneratingCrossword] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)
  const [cwTitle, setCwTitle] = useState("")
  const [cwDesc, setCwDesc] = useState("")
  const [cwDifficulty, setCwDifficulty] = useState("medium")
  const [cwLanguage, setCwLanguage] = useState("en")
  const [cwWordCount, setCwWordCount] = useState(8)
  const [cwManualTitle, setCwManualTitle] = useState("")
  const [cwManualCluesState, setCwManualCluesState] = useState<Array<{ word: string; clue: string; direction: string; number: number }>>([])
  const [crosswordPasteTitle, setCrosswordPasteTitle] = useState("")
  const [crosswordPasteText, setCrosswordPasteText] = useState("")
  const [showPresentationTypeModal, setShowPresentationTypeModal] = useState(false)
  const [showPresentationAddModal, setShowPresentationAddModal] = useState(false)
  const [showPresentationTemplateModal, setShowPresentationTemplateModal] = useState(false)
  const [showImportTextModal, setShowImportTextModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [importingText, setImportingText] = useState(false)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [articleTitle, setArticleTitle] = useState("")
  const [presTheme, setPresTheme] = useState("claude")
  const [presSize, setPresSize] = useState("16:9")
  const [presDensity, setPresDensity] = useState("standard")
  const [presStyle, setPresStyle] = useState("business")
  const [presAudience, setPresAudience] = useState("general")
  const [presSlideCount, setPresSlideCount] = useState(10)
  const [generatingPresentation, setGeneratingPresentation] = useState(false)
  const [presentationProgress, setPresentationProgress] = useState(0)
  const [presTitle, setPresTitle] = useState("")
  const [presDesc, setPresDesc] = useState("")
  const [presLanguage, setPresLanguage] = useState("en")
  const [showWatermark, setShowWatermark] = useState(true)
  const [selectedPresentationId, setSelectedPresentationId] = useState<Id<"presentations"> | null>(null)
  const [editingSlideContentId, setEditingSlideContentId] = useState<Id<"presentationSlides"> | null>(null)
  const [editingSlideField, setEditingSlideField] = useState<"title" | "content" | "speakerNotes" | null>(null)
  const [editingSlideValue, setEditingSlideValue] = useState("")
  const [showPresLangDropdown, setShowPresLangDropdown] = useState(false)
  const presLangDropdownRef = useRef<HTMLDivElement>(null)
  const [copySampleLabel, setCopySampleLabel] = useState("Copy sample")
  const [selectedCrosswordId, setSelectedCrosswordId] = useState<Id<"crosswords"> | null>(null)
  const [crosswordAnswers, setCrosswordAnswers] = useState<Record<string, string>>({})
  const [crosswordChecked, setCrosswordChecked] = useState<Record<string, boolean>>({})
  const [crosswordGridInput, setCrosswordGridInput] = useState<Record<string, string>>({})
  const [showAnswers, setShowAnswers] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [inputDirection, setInputDirection] = useState<"across" | "down">("across")
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null)
  const [pendingGeneration, setPendingGeneration] = useState<{ title: string; description: string; folderId: string | null; questionCount: number; difficulty: string; language: string } | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renamingQuizId, setRenamingQuizId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [crosswords, setCrosswords] = useState<Quiz[]>([])
  const [presentations, setPresentations] = useState<Quiz[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [generating, setGenerating] = useState(false)
  const [quizGeneratingProgress, setQuizGeneratingProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [convexSessionId, setConvexSessionId] = useState<Id<"quizSessions"> | null>(null)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())

  const getQuiz = useQuery(api.quizzes.get, convexUserId && selectedQuizId ? { quizId: selectedQuizId as Id<"quizzes"> } : "skip")
  const getSession = useQuery(api.sessions.get, convexSessionId ? { sessionId: convexSessionId as Id<"quizSessions"> } : "skip")
  const crosswordData = useQuery(api.crosswords.get, selectedCrosswordId ? { crosswordId: selectedCrosswordId } : "skip")
  const presentationData = useQuery(api.presentations.get, selectedPresentationId ? { presentationId: selectedPresentationId } : "skip")
  const teachersModeStats = useQuery(api.sharedAttempts.getMyContentStats, convexUserId && showTeachersMode ? { userId: convexUserId } : "skip")

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
  const crosswordGridRef = useRef<HTMLDivElement>(null)
  const slideImageInputRef = useRef<HTMLInputElement>(null)
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null)

  const [trashQuizzes, setTrashQuizzes] = useState<Quiz[]>([])
  const [trashFolders, setTrashFolders] = useState<Folder[]>([])
  const [trashCrosswords, setTrashCrosswords] = useState<Quiz[]>([])
  const [trashPresentations, setTrashPresentations] = useState<Quiz[]>([])

  const [botStatus, setBotStatus] = useState("checking")
  const [cfg, setCfg] = useState<Record<string, string> | null>(null)
  const [keysList, setKeysList] = useState<string[]>([])
  const [newKeyInput, setNewKeyInput] = useState("")
  const [keyResults, setKeyResults] = useState<Record<string, Record<string, any>>>({})
  const [testingKeys, setTestingKeys] = useState(false)
  const [testingSingleKey, setTestingSingleKey] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [aiTestResult, setAiTestResult] = useState<{ status: "idle" | "testing" | "success" | "error"; message: string; response: string }>({ status: "idle", message: "", response: "" })
  const [botTokenInput, setBotTokenInput] = useState("")

  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [creditMsg, setCreditMsg] = useState("")
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJson, setImportJson] = useState("")
  const keyTestStatus = useRef<Record<number, { testing: boolean; result: string }>>({})
  const [, forceRender] = useState(0)

  // Sync Convex quizzes to local state
  useEffect(() => {
    if (!convexQuizzes) return
    setQuizzes(convexQuizzes.map((q: any) => ({
      id: q._id,
      title: q.title,
      description: q.description ?? "",
      questionCount: q.questionCount,
      source: q.source,
      createdAt: new Date(q._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: q.folderId ?? null,
      questions: [],
    })))
  }, [convexQuizzes])

  useEffect(() => {
    if (!convexCrosswords) return
    setCrosswords(convexCrosswords.map((c: any) => ({
      id: c._id,
      title: c.title,
      description: c.description ?? "",
      questionCount: 0,
      source: c.source,
      createdAt: new Date(c._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: c.folderId ?? null,
      questions: [],
    })))
  }, [convexCrosswords])

  useEffect(() => {
    if (!convexPresentations) return
    setPresentations(convexPresentations.map((p: any) => ({
      id: p._id,
      title: p.title,
      description: p.description ?? "",
      questionCount: 0,
      source: p.source,
      createdAt: new Date(p._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: p.folderId ?? null,
      questions: [],
    })))
  }, [convexPresentations])

  // Sync Convex folders to local state
  useEffect(() => {
    if (!convexFolders) return
    setFolders(convexFolders.map((f: any) => ({
      id: f._id,
      name: f.name,
      quizCount: convexQuizzes ? convexQuizzes.filter((q: any) => q.folderId === f._id).length : 0,
    })))
  }, [convexFolders, convexQuizzes])

  // Sync Convex trash data
  useEffect(() => {
    if (!convexTrashQuizzes) return
    setTrashQuizzes(convexTrashQuizzes.map((q: any) => ({
      id: q._id,
      title: q.title,
      description: q.description ?? "",
      questionCount: q.questionCount,
      source: q.source,
      createdAt: new Date(q._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: q.folderId ?? null,
      questions: [],
    })))
  }, [convexTrashQuizzes])

  useEffect(() => {
    if (!convexTrashFolders) return
    setTrashFolders(convexTrashFolders.map((f: any) => ({
      id: f._id,
      name: f.name,
      quizCount: 0,
    })))
  }, [convexTrashFolders])

  useEffect(() => {
    if (!convexTrashCrosswords) return
    setTrashCrosswords(convexTrashCrosswords.map((c: any) => ({
      id: c._id,
      title: c.title,
      description: c.description ?? "",
      questionCount: 0,
      source: c.source,
      createdAt: new Date(c._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: c.folderId ?? null,
      questions: [],
    })))
  }, [convexTrashCrosswords])

  useEffect(() => {
    if (!convexTrashPresentations) return
    setTrashPresentations(convexTrashPresentations.map((p: any) => ({
      id: p._id,
      title: p.title,
      description: p.description ?? "",
      questionCount: 0,
      source: p.source,
      createdAt: new Date(p._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: p.folderId ?? null,
      questions: [],
    })))
  }, [convexTrashPresentations])

  // Sync Convex user to local state
  useEffect(() => {
    if (!convexUser) return
    setUser({
      id: convexUser._id,
      telegramId: convexUser.telegramId ?? null,
      clerkId: convexUser.clerkId,
      email: convexUser.email ?? null,
      authProvider: convexUser.authProvider,
      username: convexUser.username ?? null,
      displayName: convexUser.displayName,
      photoUrl: convexUser.photoUrl ?? null,
      languageCode: convexUser.languageCode,
      credits: convexUser.credits,
      creditsRefreshAt: convexUser.creditsRefreshAt.toString(),
    })
    setDisplayName(convexUser.displayName)
    setUsername(convexUser.username ?? localStorage.getItem("username") ?? "")
    setLanguage(convexUser.languageCode as Lang)
  }, [convexUser])

  // Handle Convex auth state transitions
  useEffect(() => {
    if (convexAuthLoading) return
    if (convexUser && screen === "login") {
      setScreen("library")
      setLoading(false)
      return
    }
    if (!convexUser && !convexAuthLoading && clerkLoaded && !clerkUser) {
      setLoading(false)
    }
  }, [convexUser, convexAuthLoading, clerkLoaded, clerkUser, screen])

  // Sync quiz data from Convex when selected
  useEffect(() => {
    if (!getQuiz) return
    setSelectedQuiz({
      id: getQuiz._id,
      title: getQuiz.title,
      description: getQuiz.description ?? "",
      questionCount: getQuiz.questionCount,
      source: getQuiz.source,
      createdAt: new Date(getQuiz._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId: getQuiz.folderId ?? null,
      questions: (getQuiz.questions ?? []).map((q: any) => ({
        id: q._id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    })
    setLoading(false)
  }, [getQuiz])

  // Sync session data from Convex
  useEffect(() => {
    if (!getSession) return
    const { session, questions: sessionQuestions } = getSession
    setSessionId(session._id)
    setSelectedQuiz(prev => prev ? {
      ...prev,
      questions: sessionQuestions.map((q: any) => ({
        id: q._id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    } : prev)
  }, [getSession])

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/bot").then(r => r.json()).catch(() => ({ data: { status: "stopped" } })),
      fetch("/api/admin/config").then(r => r.json()).catch(() => ({ data: null })),
    ]).then(([bot, c]) => {
      setBotStatus(bot.data?.status || "stopped")
      setCfg(c.data)
    })
  }, [])

  useEffect(() => {
    if (screen !== "admin") return
    const id = setInterval(() => forceRender(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [screen])

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

  // Fallback: show login if Clerk has session but Convex sync takes too long
  useEffect(() => {
    if (!clerkUser) return
    const timer = setTimeout(() => setLoading(false), 5000)
    return () => clearTimeout(timer)
  }, [clerkUser])

  // Legacy auth init (for Telegram fallback)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (presLangDropdownRef.current && !presLangDropdownRef.current.contains(e.target as Node)) {
        setShowPresLangDropdown(false)
      }
    }
    if (showPresLangDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showPresLangDropdown])

  useEffect(() => {
    async function init() {
      if (clerkLoaded && clerkUser && !convexUser) {
        try {
          const clerkToken = await getClerkToken()
          if (!clerkToken) {
            setClerkAuthError(true)
            setLoading(false)
            return
          }
          const result = await loginWithClerk(clerkToken)
          setToken(result.data.accessToken)
          localStorage.setItem("refresh_token", result.data.refreshToken)
          setUser(result.data.user)
          setDisplayName(result.data.user.displayName)
          setUsername(result.data.user.username || "")
          setLanguage((result.data.user.languageCode as Lang) || "en")
          setScreen("library")
        } catch (e) {
          console.error("[auth] Clerk exchange failed", e)
          setClerkAuthError(true)
          setLoading(false)
        }
        return
      }
      if (!clerkUser) {
        const token = localStorage.getItem("access_token")
        if (token) {
          setToken(token)
          try {
            const me = await (await fetch("/api/me")).json()
            setUser(me.data)
            setDisplayName(me.data.displayName)
            setUsername(me.data.username || "")
            setLanguage((me.data.languageCode as Lang) || "en")
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
    }
    if (clerkLoaded) {
      init()
    }
    fetch("/api/admin/kill").then(r => r.json()).then(d => { if (d.data?.killed) setSiteKilled(true) }).catch(() => {})
  }, [clerkLoaded, clerkUser, convexUser])

  // Sync cfg to input fields
  useEffect(() => {
    if (!cfg) return
    setKeysList((cfg.OPENROUTER_API_KEYS || "").split(",").map(s => s.trim()).filter(Boolean))
    setBotTokenInput(cfg.TELEGRAM_BOT_TOKEN || "")
  }, [cfg])

  // Test all keys whenever keysList changes
  useEffect(() => {
    if (keysList.length === 0) { setKeyResults({}); return }
    if (!adminPassword) return
    setTestingKeys(true)
    const results: Record<string, any> = {}
    Promise.all(keysList.map(async (key) => {
      try {
        const res = await fetch("/api/admin/test-key", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPassword, key }),
        })
        const d = await res.json()
        results[key] = { ...(d.data || {}), key }
      } catch {
        results[key] = { valid: false, key }
      }
    })).then(() => { setKeyResults(results); setTestingKeys(false) })
  }, [keysList, adminPassword])

  async function testSingleKey(key: string) {
    setTestingSingleKey(key)
    try {
      const res = await fetch("/api/admin/test-key", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, key }),
      })
      const d = await res.json()
      setKeyResults(prev => ({ ...prev, [key]: { ...(d.data || {}), key } }))
    } catch {
      setKeyResults(prev => ({ ...prev, [key]: { valid: false, canGenerate: false, key } }))
    }
    setTestingSingleKey(null)
  }

  // Load PG users for admin panel
  useEffect(() => {
    if (screen !== "admin" || !adminPassword) return
    setAdminUsers([])
    fetch(`/api/admin/users?password=${adminPassword}`)
      .then(r => r.json())
      .then(d => { if (d.data) setAdminUsers(d.data) })
      .catch(() => {})
  }, [screen, adminPassword])

  useEffect(() => {
    if (presentationData && (presentationData as any).showWatermark !== undefined) {
      setShowWatermark((presentationData as any).showWatermark)
    }
  }, [presentationData])

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
    // Data is reactive via Convex queries - just ensure loading is false
    setLoading(false)
  }

  async function handleRenameFolder(folderId: string) {
    if (!editName.trim()) { setRenamingFolderId(null); return }
    try {
      await renameCvxFolder(folderId as Id<"folders">, editName.trim())
    } catch {}
    setRenamingFolderId(null)
  }

  async function loadTrash() {
    // Data is reactive via Convex queries
  }

  async function handleDeleteFolder(folderId: string) {
    if (!confirm("Delete this folder and remove all quizzes from it?")) return
    try {
      await deleteCvxFolder(folderId as Id<"folders">)
    } catch {}
  }

  async function handleRenameQuiz(quizId: string) {
    if (!editName.trim()) { setRenamingQuizId(null); return }
    try {
      if (presentations.some(p => p.id === quizId)) {
        await updateCvxPresentation(quizId as Id<"presentations">, { title: editName.trim() })
      } else {
        await updateCvxQuiz(quizId as Id<"quizzes">, { title: editName.trim() })
      }
    } catch {}
    setRenamingQuizId(null)
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!confirm("Delete this quiz?")) return
    try {
      await deleteCvxQuiz(quizId as Id<"quizzes">)
    } catch {}
  }

  async function handleRenameCrossword(crosswordId: string) {
    if (!editName.trim()) { setRenamingQuizId(null); return }
    try {
      await updateCvxCrossword(crosswordId as Id<"crosswords">, { title: editName.trim() })
    } catch {}
    setRenamingQuizId(null)
  }

  async function handleDeleteCrossword(crosswordId: string) {
    if (!confirm("Delete this crossword?")) return
    try {
      await deleteCvxCrossword(crosswordId as Id<"crosswords">)
    } catch {}
  }

  async function handleDeletePresentation(presentationId: string) {
    if (!confirm("Delete this presentation?")) return
    try {
      await deleteCvxPresentation(presentationId as Id<"presentations">)
    } catch {}
  }

  async function handleMoveCrossword(crosswordId: string, folderId: string | null) {
    try {
      await updateCvxCrossword(crosswordId as Id<"crosswords">, { folderId: folderId as Id<"folders"> | null })
    } catch {}
  }

  async function handleDrop(e: React.DragEvent, folderId: string | null) {
    const itemId = e.dataTransfer.getData("text/item-id")
    const itemType = e.dataTransfer.getData("text/item-type")
    if (!itemId || !itemType) return
    try {
      if (itemType === "crossword") {
        await updateCvxCrossword(itemId as Id<"crosswords">, { folderId: folderId as Id<"folders"> | null })
      } else {
        await updateCvxQuiz(itemId as Id<"quizzes">, { folderId: folderId as Id<"folders"> | null })
      }
    } catch {}
  }

  function handleDragStart(e: React.DragEvent, itemId: string, itemType: "quiz" | "crossword" | "presentation") {
    e.dataTransfer.setData("text/item-id", itemId)
    e.dataTransfer.setData("text/item-type", itemType)
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
    const quizIds: Id<"quizzes">[] = []
    const crosswordIds: Id<"crosswords">[] = []
    const presentationIds: Id<"presentations">[] = []
    const folderIds: Id<"folders">[] = []
    selectedIds.forEach(id => {
      if (folders.some(f => f.id === id)) folderIds.push(id as Id<"folders">)
      else if (crosswords.some(c => c.id === id)) crosswordIds.push(id as Id<"crosswords">)
      else if (presentations.some(p => p.id === id)) presentationIds.push(id as Id<"presentations">)
      else quizIds.push(id as Id<"quizzes">)
    })
    try {
      if (quizIds.length) await batchDeleteCvxQuizzes(quizIds)
      if (crosswordIds.length) await batchDeleteCvxCrosswords(crosswordIds)
      if (presentationIds.length) await batchDeleteCvxPresentations(presentationIds)
      if (folderIds.length) await batchDeleteCvxFolders(folderIds)
      clearSelection()
    } catch {}
    setShowDeleteConfirm(false)
  }

  async function handleBatchMove(folderId: string | null) {
    const itemIds = [...selectedIds].filter(id => !folders.some(f => f.id === id))
    if (!itemIds.length) return
    const quizIds = itemIds.filter(id => !crosswords.some(c => c.id === id) && !presentations.some(p => p.id === id))
    const crosswordIds = itemIds.filter(id => crosswords.some(c => c.id === id))
    const presentationIds = itemIds.filter(id => presentations.some(p => p.id === id))
    try {
      if (quizIds.length) await batchMoveCvxQuizzes(quizIds as Id<"quizzes">[], folderId as Id<"folders"> | null)
      if (crosswordIds.length) await batchMoveCvxCrosswords(crosswordIds as Id<"crosswords">[], folderId as Id<"folders"> | null)
      if (presentationIds.length) await batchMoveCvxPresentations(presentationIds as Id<"presentations">[], folderId as Id<"folders"> | null)
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
    setSelectedQuizId(q.id as Id<"quizzes">)
    setSelectedQuiz(q); setCurrentIdx(0); setAnswers({}); setSubmitted(new Set())
    setSkipped(new Set()); setShowFeedback(false); setSelectedOpt(null); setResults(null); setRetryIds(new Set())
    const prog = loadProgress(q.id)
    setSavedProgress(prog ? { sessionId: prog.sessionId, mode: prog.mode, currentIdx: prog.currentIdx } : null)
    go("overview")
  }

  function openCrossword(q: Quiz) {
    setSelectedCrosswordId(q.id as Id<"crosswords">)
    setCrosswordAnswers({})
    setCrosswordChecked({})
    go("crossword")
  }

  async function startPractice() {
    if (!quiz || !convexUserId) return
    clearProgress()
    setSavedProgress(null)
    try {
      const result = await startCvxSession(quiz.id as Id<"quizzes">, "practice")
      setSessionId(result.sessionId)
      setConvexSessionId(result.sessionId)
      setSessionMode("practice")
      if (result.questions.length > 0) {
        setSelectedQuiz(prev => prev ? { ...prev, questions: result.questions.map((q: any) => ({ ...q, id: q._id, explanation: q.explanation ?? undefined })) } : prev)
      }
      setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
      setShowFeedback(false); setSelectedOpt(null); go("practice")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start practice")
    }
  }

  async function startExam() {
    if (!quiz || !convexUserId) return
    clearProgress()
    setSavedProgress(null)
    try {
      const result = await startCvxSession(quiz.id as Id<"quizzes">, "exam")
      setSessionId(result.sessionId)
      setConvexSessionId(result.sessionId)
      setSessionMode("exam")
      if (result.questions.length > 0) {
        setSelectedQuiz(prev => prev ? { ...prev, questions: result.questions.map((q: any) => ({ ...q, id: q._id, explanation: q.explanation ?? undefined })) } : prev)
      }
      setCurrentIdx(0); setAnswers({}); setSubmitted(new Set()); setSkipped(new Set())
      setShowFeedback(false); setSelectedOpt(null); setExamTimeLeft((result.questions.length || quiz.questionCount) * 60); go("exam")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start exam")
    }
  }

  function answer(i: number) {
    if (isExam) {
      setAnswers(p => ({ ...p, [curQ.id]: i }))
      if (sessionId && convexSessionId) { submitCvxAnswer(convexSessionId, curQ.id as Id<"questions">, i).catch(() => {}) }
    } else {
      setSelectedOpt(i)
    }
  }

  function submitAns() {
    if (selectedOpt === null) return
    setAnswers(p => ({ ...p, [curQ.id]: selectedOpt }))
    setSubmitted(p => new Set(p).add(curQ.id)); setShowFeedback(true)
    if (sessionId && convexSessionId) { submitCvxAnswer(convexSessionId, curQ.id as Id<"questions">, selectedOpt).catch(() => {}) }
  }

  async function doSkip() {
    setSkipped(p => new Set(p).add(curQ.id))
    setSubmitted(p => new Set(p).add(curQ.id))
    if (sessionId && convexSessionId) {
      try { await skipCvxQuestion(convexSessionId, curQ.id as Id<"questions">) } catch {}
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
    if (sessionId && convexSessionId) {
      try {
        const timeSeconds = isExam ? allQ.length * 60 - examTimeLeft : undefined
        await completeCvxSession(convexSessionId, timeSeconds)
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

  async function handleFlagQuestion(reason: string) {
    if (!curQ || !convexUserId || !quiz?.userId) return
    try {
      await reportQuestion(convexUserId, quiz.userId as Id<"users">, curQ.id as Id<"questions">, reason)
      setFlaggedQuestions(prev => new Set(prev).add(curQ.id))
      setShowFlagModal(false)
    } catch (e) {
      console.error("Failed to report question:", e)
    }
  }

  async function resumeQuiz() {
    const prog = savedProgress
    if (!prog || !quiz) return
    try {
      setConvexSessionId(prog.sessionId as Id<"quizSessions">)
      setSessionId(prog.sessionId)
      setSessionMode(prog.mode)
      const prog2 = loadProgress(quiz.id)
      setCurrentIdx(prog2?.currentIdx ?? prog.currentIdx)
      setAnswers(prog2?.answers ?? {})
      setSkipped(prog2?.skipped ?? new Set())
      setSubmitted(prog2?.submitted ?? new Set())
      setShowFeedback(false); setSelectedOpt(null)
      if (prog.mode === "exam") {
        setExamTimeLeft(quiz.questionCount * 60)
      }
      go(prog.mode === "exam" ? "exam" : "practice")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resume session")
    }
  }

  async function addFolder(name: string) {
    if (!name.trim() || !convexUserId) return ""
    try {
      const id = await createCvxFolder(name.trim())
      setExpandedFolders(p => new Set(p).add(id))
      setNewFolderName("")
      setShowNewFolderInput(false)
      return id
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

  async function generateWithAI(title: string, description: string, folderId: string | null, questionCount?: number, difficulty?: string, language?: string, clarificationAnswer?: string) {
    if (!convexUserId) return
    setGenerating(true)
    setQuizGeneratingProgress(0)
    try {
      setQuizGeneratingProgress(10)
      const result = await generateCvxQuiz(
        convexUserId,
        title,
        description || undefined,
        (folderId ?? undefined) as Id<"folders"> | undefined,
        questionCount,
        difficulty,
        language,
      )
      setQuizGeneratingProgress(90)
      const quizId = result.quizId as Id<"quizzes">
      setQuizGeneratingProgress(100)
      setShowAddModal(false)
      setGenerating(false)
      setSelectedQuizId(quizId)
      const q: Quiz = {
        id: quizId,
        title,
        description: description || "",
        questionCount: questionCount ?? 5,
        source: "ai_generated",
        createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        folderId,
        questions: [],
      }
      openQuiz(q)
    } catch (err) {
      setGenerating(false)
      setQuizGeneratingProgress(0)
      alert(err instanceof Error ? err.message : "Failed to generate quiz")
    }
  }

  function handleClarify(answer: string) {
    if (!pendingGeneration) return
    setClarificationQuestion(null)
    setPendingGeneration(null)
    generateWithAI(pendingGeneration.title, pendingGeneration.description, pendingGeneration.folderId, pendingGeneration.questionCount, pendingGeneration.difficulty, pendingGeneration.language, answer)
  }

  async function generateCrosswordWithAI(title: string, description: string, folderId: string | null, difficulty?: string, language?: string, gridSize?: number, wordCount?: number) {
    if (!convexUserId) return
    setGeneratingCrossword(true)
    setGeneratingProgress(0)
    try {
      setGeneratingProgress(10)
      const result = await generateCvxCrossword(
        convexUserId,
        title,
        description || undefined,
        (folderId ?? undefined) as Id<"folders"> | undefined,
        difficulty,
        language,
        gridSize,
        wordCount,
      )
      setGeneratingProgress(90)
      const crosswordId = result.crosswordId as Id<"crosswords">
      setGeneratingProgress(100)
      setShowCrosswordAddModal(false)
      setGeneratingCrossword(false)
      alert("Crossword created successfully!")
    } catch (err) {
      setGeneratingCrossword(false)
      setGeneratingProgress(0)
      alert(err instanceof Error ? err.message : "Failed to generate crossword")
    }
  }

  async function createManualCrossword(title: string, description: string, folderId: string | null, clues: Array<{ word: string; clue: string; direction: string; number: number; order: number }>) {
    if (!convexUserId) return
    try {
      const crosswordData: any = {
        title,
        description: description || undefined,
        source: "manual",
        clues: clues.map((c, i) => ({ ...c, order: i, row: undefined, col: undefined })),
      }
      if (folderId) crosswordData.folderId = folderId
      await createCvxCrossword(crosswordData)
      setShowCrosswordManualModal(false)
      alert("Crossword created successfully!")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create crossword")
    }
  }

  async function createCrosswordFromText(title: string, text: string, folderId: string | null) {
    if (!convexUserId) return
    try {
      const pairs = parseCrosswordInput(text)
      const result = generateCrosswordGrid(pairs)
      if (result.placements.length === 0) {
        alert("Could not place any words in the grid. Try different clues.")
        return
      }
      if (result.placements.length < pairs.length) {
        const placed = result.placements.map(p => p.word).join(", ")
        alert(`Some words could not be placed: only ${result.placements.length}/${pairs.length} words fit.\nPlaced: ${placed}`)
      }
      const data: any = {
        title,
        source: "manual",
        gridWidth: result.width,
        gridHeight: result.height,
        clues: result.placements.map(p => ({
          word: p.word,
          clue: p.clue,
          direction: p.direction,
          row: p.row,
          col: p.col,
          number: p.number,
          order: p.order,
        })),
      }
      if (folderId) data.folderId = folderId
      await createCvxCrossword(data)
      setShowCrosswordPasteModal(false)
      setCrosswordPasteText("")
      setCrosswordPasteTitle("")
      alert("Crossword created successfully!")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create crossword")
    }
  }

  async function generatePresentationWithAI(title: string, description: string, folderId: string | null, language?: string) {
    if (!convexUserId) return
    setGeneratingPresentation(true)
    setPresentationProgress(0)
    try {
      setPresentationProgress(10)
      const result = await generateCvxPresentation(
        convexUserId,
        title,
        description || undefined,
        (folderId ?? undefined) as Id<"folders"> | undefined,
        language,
        presTheme,
        presSize,
        presDensity,
        presStyle,
        presAudience,
        presSlideCount,
      )
      setPresentationProgress(90)
      const presentationId = result.presentationId as Id<"presentations">
      setPresentationProgress(100)
      setShowPresentationAddModal(false)
      setGeneratingPresentation(false)
      setSelectedPresentationId(presentationId)
      go("presentation")
    } catch (err) {
      setGeneratingPresentation(false)
      setPresentationProgress(0)
      alert(err instanceof Error ? err.message : "Failed to generate presentation")
    }
  }

  async function openPresentation(q: Quiz) {
    setSelectedPresentationId(q.id as Id<"presentations">)
    go("presentation")
  }

  async function handleUploadSlideImage(slideId: Id<"presentationSlides">, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert("Image too large (max 10MB)")
      return
    }
    try {
      const formData = new FormData()
      formData.append("file", file)
      const token = localStorage.getItem("access_token") || ""
      const res = await fetch("/api/files/upload-image", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || "Upload failed")
      await updateCvxSlideImage(slideId, data.data.url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload image")
    }
  }

  async function handleRemoveSlideImage(slideId: Id<"presentationSlides">) {
    try {
      await updateCvxSlideImage(slideId, undefined)
    } catch {}
  }

  async function handleDownloadPptx() {
    const PptxGenJS = (await import("pptxgenjs")).default
    if (!presentationData) return

    const themes: Record<string, { titleFont: string; bodyFont: string; titleColor: string; bodyColor: string; accent: string; accentLight: string; bg: string; mutedColor: string }> = {
      claude: {
        titleFont: "Playfair Display, Georgia, serif",
        bodyFont: "DM Sans, Inter, sans-serif",
        titleColor: "141413",
        bodyColor: "3D3D3A",
        accent: "CC785C",
        accentLight: "E8C4B0",
        bg: "FAF9F5",
        mutedColor: "6C6A64",
      },
      apple: {
        titleFont: "Space Grotesk, Inter, sans-serif",
        bodyFont: "Outfit, Inter, sans-serif",
        titleColor: "1D1D1F",
        bodyColor: "333333",
        accent: "0066CC",
        accentLight: "D6EAFF",
        bg: "FFFFFF",
        mutedColor: "6E6E73",
      },
      hp: {
        titleFont: "Space Grotesk, Inter, sans-serif",
        bodyFont: "DM Sans, Inter, sans-serif",
        titleColor: "1A1A1A",
        bodyColor: "333333",
        accent: "024AD8",
        accentLight: "D6DEFF",
        bg: "FFFFFF",
        mutedColor: "636363",
      },
      minimal: {
        titleFont: "Inter, sans-serif",
        bodyFont: "Inter, sans-serif",
        titleColor: "111111",
        bodyColor: "333333",
        accent: "111111",
        accentLight: "E5E5E5",
        bg: "FFFFFF",
        mutedColor: "888888",
      },
      dark: {
        titleFont: "Inter, sans-serif",
        bodyFont: "Inter, sans-serif",
        titleColor: "FFFFFF",
        bodyColor: "CCCCCC",
        accent: "A78BFA",
        accentLight: "2D2040",
        bg: "0F0F0F",
        mutedColor: "808080",
      },
      gradient: {
        titleFont: "Inter, sans-serif",
        bodyFont: "Inter, sans-serif",
        titleColor: "1A1A1A",
        bodyColor: "333333",
        accent: "F97316",
        accentLight: "FFF7ED",
        bg: "FFFBF5",
        mutedColor: "666666",
      },
      nature: {
        titleFont: "Georgia, serif",
        bodyFont: "Inter, sans-serif",
        titleColor: "1A2E1A",
        bodyColor: "2D3A2D",
        accent: "2D6A4F",
        accentLight: "D4E8DC",
        bg: "F5F0E8",
        mutedColor: "5A6B5A",
      },
      neon: {
        titleFont: "Inter, sans-serif",
        bodyFont: "Inter, sans-serif",
        titleColor: "FFFFFF",
        bodyColor: "CCCCCC",
        accent: "22D3EE",
        accentLight: "0A2030",
        bg: "0A0A0A",
        mutedColor: "808080",
      },
      corporate: {
        titleFont: "Inter, sans-serif",
        bodyFont: "Inter, sans-serif",
        titleColor: "0F172A",
        bodyColor: "334155",
        accent: "1E40AF",
        accentLight: "DBEAFE",
        bg: "F8FAFC",
        mutedColor: "64748B",
      },
    }
    const exportTheme = (presentationData as any)?.theme || presTheme || "claude"
    const th = themes[exportTheme] || themes.claude

    function addBaseDecorations(s: any, slideIdx: number) {
      if (exportTheme === "claude") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: th.accent } })
      } else if (exportTheme === "apple") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.04, fill: { color: th.accent } })
      } else if (exportTheme === "hp") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.3, fill: { color: th.accent } })
      } else if (exportTheme === "minimal") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.02, fill: { color: th.accent } })
      } else if (exportTheme === "dark" || exportTheme === "neon") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: th.accent } })
      } else if (exportTheme === "gradient") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: "F97316" } })
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.06, w: "100%", h: 0.02, fill: { color: "EC4899" } })
      } else if (exportTheme === "nature") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: th.accent } })
      } else if (exportTheme === "corporate") {
        s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.04, fill: { color: th.accent } })
      }
    }

    function addTitleSlide(s: any, slideIdx: number) {
      if (exportTheme === "claude") {
        s.background = { fill: "FAF9F5" }
        // Dark card behind title (matching Presenter's bg-[#181715])
        s.addShape(pptx.ShapeType.rect, {
          x: 1.5, y: 2.0, w: 10.3, h: 3.5,
          fill: { color: "181715" },
          rectRadius: 0.15,
        })
      }
    }

    function addSectionDividerDecorations(s: any, slideIdx: number) {
      const bgColors: Record<string, string> = {
        claude: "A8553A", apple: "0066CC", hp: "024AD8", minimal: "111111",
        dark: "1A1A2E", gradient: "F97316", nature: "2D6A4F", neon: "0A1628", corporate: "1E293B",
      }
      s.background = { fill: bgColors[exportTheme] || "024AD8" }
    }

    const pptx = new PptxGenJS()
    const presSize = (presentationData as any).size || "16:9"
    pptx.layout = presSize === "4:3" ? "LAYOUT_4x3" : presSize === "9:16" ? "LAYOUT_16x9" : "LAYOUT_WIDE"
    pptx.author = "QuizFlow"
    pptx.title = presentationData.title

    for (const [slideIdx, slide] of presentationData.slides.entries()) {
      const s = pptx.addSlide()
      s.background = { fill: th.bg }
      const isTitle = slide.layout === "title"
      const isSection = slide.layout === "sectionDivider"
      const isStats = slide.layout === "stats"
      const isQuote = slide.layout === "quote"
      const fs = (slide as any).fontSize || "md"
      const fontScale = fs === "xs" ? 0.75 : fs === "sm" ? 0.875 : fs === "lg" ? 1.15 : fs === "xl" ? 1.3 : 1

      addBaseDecorations(s, slideIdx)

      if (isTitle) {
        addTitleSlide(s, slideIdx)
        if (exportTheme === "claude") {
          // Title on dark card
          s.addText(slide.title, {
            x: 2.0, y: 2.7, w: 9.3, h: 1.5,
            fontSize: Math.round(38 * fontScale), fontFace: th.titleFont, color: "FFFFFF",
            align: "center", bold: true,
          })
          if (slide.content.length > 0) {
            s.addText(slide.content[0], {
              x: 2.0, y: 4.2, w: 9.3, h: 0.8,
              fontSize: Math.round(16 * fontScale), fontFace: th.bodyFont, color: "CC785C",
              align: "center",
            })
          }
        } else if (exportTheme === "apple") {
          s.addText(slide.title, {
            x: 1.0, y: 2.0, w: 10, h: 2.0,
            fontSize: Math.round(44 * fontScale), fontFace: th.titleFont, color: th.titleColor,
            bold: true,
          })
          if (slide.content.length > 0) {
            s.addText(slide.content[0], {
              x: 1.0, y: 3.8, w: 8, h: 0.6,
              fontSize: Math.round(18 * fontScale), fontFace: th.bodyFont, color: th.mutedColor,
            })
          }
        } else {
          // HP
          s.addText(slide.title, {
            x: 1.5, y: 2.0, w: 10, h: 1.5,
            fontSize: Math.round(36 * fontScale), fontFace: th.titleFont, color: th.titleColor,
            bold: true,
          })
          if (slide.content.length > 0) {
            s.addText(slide.content[0], {
              x: 1.5, y: 3.5, w: 8, h: 0.6,
              fontSize: Math.round(16 * fontScale), fontFace: th.bodyFont, color: th.mutedColor,
            })
          }
          // Blue underline
          s.addShape(pptx.ShapeType.rect, {
            x: 1.5, y: 3.3, w: 2, h: 0.04,
            fill: { color: th.accent },
          })
        }
      } else if (isSection) {
        addSectionDividerDecorations(s, slideIdx)
        if (exportTheme === "claude") {
          s.addText(slide.title, {
            x: 1.0, y: 2.8, w: 11.3, h: 1.2,
            fontSize: Math.round(32 * fontScale), fontFace: th.titleFont, color: "FFFFFF",
            align: "center", bold: true,
          })
          if (slide.content.length > 0) {
            s.addText(slide.content[0], {
              x: 1.0, y: 4.0, w: 11.3, h: 0.6,
              fontSize: Math.round(14 * fontScale), fontFace: th.bodyFont, color: "FFFFFF",
              align: "center",
            })
          }
        } else if (exportTheme === "apple") {
          s.addText(slide.title, {
            x: 2.0, y: 2.8, w: 9.3, h: 1.2,
            fontSize: Math.round(32 * fontScale), fontFace: th.titleFont, color: th.accent,
            align: "center", bold: true,
          })
          if (slide.content.length > 0) {
            s.addText(slide.content[0], {
              x: 2.0, y: 4.0, w: 9.3, h: 0.6,
              fontSize: Math.round(14 * fontScale), fontFace: th.bodyFont, color: th.mutedColor,
              align: "center",
            })
          }
        } else {
          s.addText(slide.title, {
            x: 1.0, y: 2.5, w: 11.3, h: 1.2,
            fontSize: Math.round(32 * fontScale), fontFace: th.titleFont, color: "FFFFFF",
            align: "center", bold: true,
          })
          if (slide.content.length > 0) {
            s.addText(slide.content[0], {
              x: 1.0, y: 3.8, w: 11.3, h: 0.6,
              fontSize: Math.round(14 * fontScale), fontFace: th.bodyFont, color: "FFFFFF",
              align: "center",
            })
          }
        }
      } else if (isStats && slide.content.length > 0) {
        // Stats slide — matching Presenter layout
        const stats = slide.content.filter((c: string) => c.includes("|")).slice(0, 4)
        const statCount = stats.length
        const gap = 0.3
        const totalGap = gap * (statCount - 1)
        const colW = (11.3 - totalGap) / statCount
        const startX = 1.0

        // Title
        s.addText(slide.title, {
          x: startX, y: 0.6, w: 11.3, h: 0.7,
          fontSize: Math.round(26 * fontScale), fontFace: th.titleFont, color: th.titleColor,
          bold: true,
        })
        // Short accent divider (matching Presenter's w-16)
        s.addShape(pptx.ShapeType.rect, {
          x: startX, y: 1.4, w: 1.0, h: 0.03,
          fill: { color: th.accent },
        })

        stats.forEach((stat: string, i: number) => {
          const [num, label] = stat.split("|")
          const x = startX + i * (colW + gap)
          // Stat card background
          s.addShape(pptx.ShapeType.rect, {
            x: x, y: 2.0, w: colW, h: 3.8,
            fill: { color: exportTheme === "claude" ? "181715" : (i % 2 === 0 ? th.accentLight : "F0F4FF") },
            rectRadius: 0.1,
          })
          // Large number
          s.addText(num || "", {
            x: x, y: 2.4, w: colW, h: 1.6,
            fontSize: Math.round(36 * fontScale), fontFace: th.titleFont,
            color: exportTheme === "claude" ? "CC785C" : th.accent,
            align: "center", bold: true,
          })
          // Label
          s.addText(label || "", {
            x: x + 0.15, y: 4.0, w: colW - 0.3, h: 1.4,
            fontSize: Math.round(12 * fontScale), fontFace: th.bodyFont,
            color: exportTheme === "claude" ? "FFFFFF" : th.bodyColor,
            align: "center",
            valign: "middle",
          })
        })
      } else if (isQuote && slide.content.length > 0) {
        // Quote slide
        if (exportTheme === "claude") {
          // Large decorative quotation mark
          s.addText("\u201C", {
            x: 1.5, y: 1.0, w: 2, h: 2,
            fontSize: 120, fontFace: "Georgia, serif",
            color: th.accentLight, bold: true,
          })
          // Quote text
          s.addText(slide.content[0] || "", {
            x: 2.0, y: 2.2, w: 9.3, h: 2.5,
            fontSize: Math.round(22 * fontScale), fontFace: "Georgia, serif",
            color: th.titleColor, italic: true,
            valign: "middle",
          })
          // Attribution
          if (slide.content.length > 1) {
            s.addShape(pptx.ShapeType.rect, {
              x: 2.0, y: 4.8, w: 1.5, h: 0.03,
              fill: { color: th.accent },
            })
            s.addText(slide.content[1], {
              x: 2.0, y: 5.0, w: 9.3, h: 0.5,
              fontSize: Math.round(14 * fontScale), fontFace: th.bodyFont,
              color: th.mutedColor,
            })
          }
        } else if (exportTheme === "apple") {
          // Left blue accent bar
          s.addShape(pptx.ShapeType.rect, {
            x: 1.5, y: 1.5, w: 0.06, h: 4.5,
            fill: { color: th.accent },
          })
          // Quote text
          s.addText(slide.content[0] || "", {
            x: 2.2, y: 1.5, w: 9.5, h: 3.5,
            fontSize: Math.round(24 * fontScale), fontFace: th.titleFont,
            color: th.titleColor, italic: true,
            valign: "middle",
          })
          // Attribution
          if (slide.content.length > 1) {
            s.addText(slide.content[1], {
              x: 2.2, y: 5.0, w: 9.5, h: 0.5,
              fontSize: Math.round(14 * fontScale), fontFace: th.bodyFont,
              color: th.accent, bold: true,
            })
          }
        } else {
          // HP — blue left border with structured quote
          s.addShape(pptx.ShapeType.rect, {
            x: 1.0, y: 1.5, w: 0.08, h: 4.5,
            fill: { color: th.accent },
          })
          s.addText(slide.content[0] || "", {
            x: 1.8, y: 1.5, w: 10, h: 3.5,
            fontSize: Math.round(22 * fontScale), fontFace: th.titleFont,
            color: th.titleColor, italic: true,
            valign: "middle",
          })
          if (slide.content.length > 1) {
            s.addText(slide.content[1], {
              x: 1.8, y: 5.0, w: 10, h: 0.5,
              fontSize: Math.round(14 * fontScale), fontFace: th.bodyFont,
              color: th.accent, bold: true,
            })
          }
        }
      } else if (slide.layout === "twoColumn" && slide.content.length === 2) {
        // Two-column layout
        s.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.7, h: 0.8,
          fontSize: Math.round(28 * fontScale), fontFace: th.titleFont, color: th.titleColor,
          bold: true,
        })
        // Accent divider
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 1.3, w: 2.0, h: 0.03,
          fill: { color: th.accent },
        })
        // Column backgrounds
        const colBg = exportTheme === "claude" ? "181715" : (exportTheme === "apple" ? "F5F5F7" : "F0F4FF")
        const colTextColor = exportTheme === "claude" ? "FFFFFF" : th.bodyColor
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 1.7, w: 5.5, h: 4.2,
          fill: { color: colBg },
          rectRadius: 0.1,
        })
        s.addShape(pptx.ShapeType.rect, {
          x: 6.8, y: 1.7, w: 5.5, h: 4.2,
          fill: { color: colBg },
          rectRadius: 0.1,
        })
        // Column labels
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 1.7, w: 5.5, h: 0.4,
          fill: { color: th.accent },
          rectRadius: 0.1,
        })
        s.addShape(pptx.ShapeType.rect, {
          x: 6.8, y: 1.7, w: 5.5, h: 0.4,
          fill: { color: th.accent },
          rectRadius: 0.1,
        })
        s.addText((slide.content[0] || "").split("\n")[0].substring(0, 20) || "Left", {
          x: 1.0, y: 1.7, w: 5, h: 0.4,
          fontSize: Math.round(10 * fontScale), fontFace: th.bodyFont, color: "FFFFFF",
          bold: true,
        })
        s.addText((slide.content[1] || "").split("\n")[0].substring(0, 20) || "Right", {
          x: 7.0, y: 1.7, w: 5, h: 0.4,
          fontSize: Math.round(10 * fontScale), fontFace: th.bodyFont, color: "FFFFFF",
          bold: true,
        })
        // Column content
        s.addText(slide.content[0], {
          x: 1.1, y: 2.3, w: 4.9, h: 3.4,
          fontSize: Math.round(15 * fontScale), fontFace: th.bodyFont, color: colTextColor,
          valign: "top", lineSpacingMultiple: 1.4,
        })
        s.addText(slide.content[1], {
          x: 7.1, y: 2.3, w: 4.9, h: 3.4,
          fontSize: Math.round(15 * fontScale), fontFace: th.bodyFont, color: colTextColor,
          valign: "top", lineSpacingMultiple: 1.4,
        })
      } else {
        // titleContent / blank — standard content slide
        s.addText(slide.title, {
          x: 0.8, y: 0.4, w: 11.7, h: 0.8,
          fontSize: Math.round(28 * fontScale), fontFace: th.titleFont, color: th.titleColor,
          bold: true,
        })
        // Accent divider
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 1.3, w: 2.0, h: 0.03,
          fill: { color: th.accent },
        })
        if (slide.content.length > 0) {
          // Content card background
          const cardBg = exportTheme === "claude" ? "181715" : (exportTheme === "apple" ? "F5F5F7" : "F0F4FF")
          const cardText = exportTheme === "claude" ? "FFFFFF" : th.bodyColor
          s.addShape(pptx.ShapeType.rect, {
            x: 0.8, y: 1.7, w: 11.5, h: 4.3,
            fill: { color: cardBg },
            rectRadius: 0.1,
          })
          const bullets = slide.content.map((point: string) => ({
            text: point,
            options: {
              fontSize: Math.round(16 * fontScale), fontFace: th.bodyFont, color: cardText,
              bullet: { code: "2022", color: th.accent },
              breakLine: true,
            },
          }))
          s.addText(bullets, {
            x: 1.2, y: 2.0, w: 10.7, h: 3.7,
            valign: "top",
            lineSpacingMultiple: 1.6,
          })
        }
      }

      // Slide number (except title slides)
      if (!isTitle) {
        s.addText(`${slideIdx + 1}`, {
          x: 12.2, y: 6.8, w: 0.8, h: 0.4,
          fontSize: Math.round(10 * fontScale), fontFace: th.bodyFont, color: th.mutedColor,
          align: "center",
        })
      }

      // Image embedding — matching Presenter (small bottom-right)
      if (slide.imageUrl && !isTitle && !isSection && !isStats && !isQuote) {
        try {
          const imgRes = await fetch(slide.imageUrl)
          if (imgRes.ok) {
            const blob = await imgRes.blob()
            const arrayBuf = await blob.arrayBuffer()
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))
            const imgData = `image/${blob.type.split("/")[1] || "jpeg"}`
            s.addImage({
              data: `data:${imgData};base64,${base64}`,
              x: 10.5, y: 5.2, w: 2.0, h: 1.5,
              rounding: true,
              transparency: 20,
            })
          }
        } catch {}
      }
      // Title/section slides: full-bleed background image
      if (slide.imageUrl && (isTitle || isSection)) {
        try {
          const imgRes = await fetch(slide.imageUrl)
          if (imgRes.ok) {
            const blob = await imgRes.blob()
            const arrayBuf = await blob.arrayBuffer()
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))
            const imgData = `image/${blob.type.split("/")[1] || "jpeg"}`
            s.addImage({
              data: `data:${imgData};base64,${base64}`,
              x: 0, y: 0, w: 13.33, h: 7.5,
              transparency: isTitle ? 80 : 75,
            })
          }
        } catch {}
      }

      // QuizFlow branding
      if (showWatermark) {
        s.addText("QuizFlow", {
          x: 0.8, y: 6.9, w: 2, h: 0.3,
          fontSize: Math.round(9 * fontScale), fontFace: th.bodyFont, color: th.mutedColor,
        })
      }

      // Speaker notes
      if ((slide as any).speakerNotes) {
        s.addNotes((slide as any).speakerNotes)
      }
    }

    // Build OOXML animation XML for a slide based on layout
    function buildSlideAnimXml(layout: string, shapeCount: number): string {
      // Animation presets per layout role
      // presetID: 10=fade, 2=flyIn, 53=growTurn, 52=swivel, 54=bounce, 56=appear, 85=split, 58=zoom
      // presetSubtype for flyIn: 4=bottom, 8=top, 1=left, 2=right
      const configs: Array<{ presetID: number; presetSubtype: number; filter: string; delay: number; duration: number }> = []

      if (layout === "title") {
        // Title: fade up, subtitle: fly from right
        configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 0, duration: 800 })
        if (shapeCount > 2) configs.push({ presetID: 2, presetSubtype: 1, filter: "fly(left)", delay: 200, duration: 600 })
        // Decoration shapes: wipe
        for (let i = 3; i <= shapeCount; i++) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 300, duration: 500 })
      } else if (layout === "sectionDivider") {
        // Section: growAndTurn title, fade subtitle
        configs.push({ presetID: 53, presetSubtype: 0, filter: "growAndTurn", delay: 0, duration: 800 })
        if (shapeCount > 1) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 200, duration: 600 })
        for (let i = 3; i <= shapeCount; i++) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 300, duration: 500 })
      } else if (layout === "stats") {
        // Stats: title parallax (fade), accent wipe, each card bounces in staggered
        configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 0, duration: 600 }) // title
        if (shapeCount > 1) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 100, duration: 400 }) // accent divider
        let cardDelay = 200
        for (let i = 3; i <= shapeCount; i++) {
          // Each stat gets 3 elements: card bg, number, label
          configs.push({ presetID: 54, presetSubtype: 0, filter: "bounce", delay: cardDelay, duration: 800 }) // card bg
          if (i + 1 <= shapeCount) { configs.push({ presetID: 54, presetSubtype: 0, filter: "bounce", delay: cardDelay + 100, duration: 800 }); i++ } // number
          if (i + 1 <= shapeCount) { configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: cardDelay + 200, duration: 500 }); i++ } // label
          cardDelay += 250
        }
      } else if (layout === "quote") {
        // Quote: rotate/swivel quotation mark, fade text, typewriter/appear attribution
        configs.push({ presetID: 52, presetSubtype: 0, filter: "swivel", delay: 0, duration: 800 }) // quote mark
        if (shapeCount > 1) configs.push({ presetID: 2, presetSubtype: 1, filter: "fly(left)", delay: 200, duration: 700 }) // quote text
        if (shapeCount > 2) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 400, duration: 400 }) // divider
        if (shapeCount > 3) configs.push({ presetID: 56, presetSubtype: 0, filter: "appear", delay: 500, duration: 400 }) // attribution
        for (let i = 5; i <= shapeCount; i++) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 300, duration: 500 })
      } else if (layout === "twoColumn") {
        // TwoColumn: title fade, accent wipe, left card fly from left, right card fly from right
        configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 0, duration: 600 }) // title
        if (shapeCount > 1) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 100, duration: 400 }) // accent
        if (shapeCount > 2) configs.push({ presetID: 2, presetSubtype: 1, filter: "fly(left)", delay: 200, duration: 700 }) // left card bg
        if (shapeCount > 3) configs.push({ presetID: 2, presetSubtype: 2, filter: "fly(right)", delay: 200, duration: 700 }) // right card bg
        // Label bars + labels + content
        for (let i = 5; i <= shapeCount; i++) {
          configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 300 + (i - 5) * 100, duration: 500 })
        }
      } else {
        // titleContent / default: title fade, accent wipe, card/content fade staggered
        configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 0, duration: 600 }) // title
        if (shapeCount > 1) configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 100, duration: 400 }) // accent
        if (shapeCount > 2) configs.push({ presetID: 2, presetSubtype: 1, filter: "fly(left)", delay: 200, duration: 700 }) // card bg
        for (let i = 4; i <= shapeCount; i++) {
          configs.push({ presetID: 10, presetSubtype: 0, filter: "fade", delay: 200 + (i - 4) * 150, duration: 600 })
        }
      }

      // Build OOXML animation tree
      let idCounter = 1
      const nextId = () => idCounter++

      let seqChildren = ""
      let bldEntries = ""
      configs.forEach((cfg, idx) => {
        const spid = idx + 1
        if (spid > shapeCount) return
        const parId = nextId()
        const ctnMain = nextId()
        const ctnInner = nextId()
        const ctnAnim = nextId()
        const ctnDur = nextId()
        const ctnEffect = nextId()

        bldEntries += `<p:bldP spid="${spid}" grpId="0" animBg="1"/>`
        seqChildren += `
          <p:par>
            <p:cTn id="${parId}" fill="hold">
              <p:stCondLst><p:cond delay="0"/></p:stCondLst>
              <p:childTnLst>
                <p:par>
                  <p:cTn id="${ctnMain}" fill="hold">
                    <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                    <p:childTnLst>
                      <p:par>
                        <p:cTn id="${ctnInner}" presetID="${cfg.presetID}" presetClass="entr" presetSubtype="${cfg.presetSubtype}" fill="hold" grpId="0" nodeType="clickEffect">
                          <p:stCondLst><p:cond delay="${cfg.delay}"/></p:stCondLst>
                          <p:childTnLst>
                            <p:set>
                              <p:cBhvr>
                                <p:cTn id="${nextId()}" dur="1" fill="hold">
                                  <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                                </p:cTn>
                                <p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>
                                <p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>
                              </p:cBhvr>
                              <p:to><p:strVal val="visible"/></p:to>
                            </p:set>
                            <p:animEffect transition="in" filter="${cfg.filter}">
                              <p:cBhvr>
                                <p:cTn id="${ctnDur}" dur="${cfg.duration}"/>
                                <p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>
                              </p:cBhvr>
                            </p:animEffect>
                          </p:childTnLst>
                        </p:cTn>
                      </p:par>
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
              </p:childTnLst>
            </p:cTn>
          </p:par>`
      })

      if (configs.length === 0) return ""

      return `<p:timing>
        <p:tnLst>
          <p:par>
            <p:cTn id="${nextId()}" dur="indefinite" restart="never" nodeType="tmRoot">
              <p:childTnLst>
                <p:seq concurrent="1" nextAc="seek">
                  <p:cTn id="${nextId()}" dur="indefinite" nodeType="mainSeq">
                    <p:childTnLst>${seqChildren}
                    </p:childTnLst>
                  </p:cTn>
                  <p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>
                  <p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>
                </p:seq>
              </p:childTnLst>
            </p:cTn>
          </p:par>
        </p:tnLst>
        <p:bldLst>${bldEntries}</p:bldLst>
      </p:timing>`
    }

    const fileName = presentationData.title.replace(/[^a-zA-Z0-9]/g, "_")
    // Write as buffer, inject transitions + animations, then save
    const buffer = await pptx.write({ outputType: "nodebuffer" } as any)
    const JSZip = (await import("jszip")).default
    const zip = await JSZip.loadAsync(buffer)
    // Inject transition + animation XML into each slide
    for (let i = 0; i < presentationData.slides.length; i++) {
      const slidePath = `ppt/slides/slide${i + 1}.xml`
      const slideFile = zip.file(slidePath)
      if (slideFile) {
        let xml = await slideFile.async("string")
        // Count shapes in this slide
        const shapeCount = (xml.match(/<p:sp>/g) || []).length
        const layout = presentationData.slides[i].layout || "titleContent"
        // Build animation XML
        const animXml = buildSlideAnimXml(layout, shapeCount)
        // Transition XML
        const transXml = '<p:transition spd="med" advClick="1"><p:fade/></p:transition>'
        // Inject before closing </p:sld>
        xml = xml.replace("</p:sld>", transXml + animXml + "</p:sld>")
        zip.file(slidePath, xml)
      }
    }
    const finalBuffer = await zip.generateAsync({ type: "nodebuffer" })
    const blob = new Blob([new Uint8Array(finalBuffer)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${fileName}.pptx`; a.click()
    URL.revokeObjectURL(url)
  }

  function handlePaste(title: string, description: string, questions: Question[], folderId: string | null) {
    const q: Quiz = {
      id: crypto.randomUUID(), title, description, questionCount: questions.length,
      source: "Pasted JSON", createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      folderId, questions,
    }
    setQuizzes(p => [...p, q])
    setShowPasteModal(false)
    openQuiz(q)
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
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3">
        <Loader size="md" variant="spin" className="text-steel" />
      </div>
    )
  }

  if (!user) {
    const isTelegram = typeof window !== "undefined" && !!(window as any).Telegram?.WebApp
    return (
      <div key="login" className="min-h-screen bg-gradient-to-b from-hero-sky-from to-hero-sky-to px-6 animate-slide-up">
        <div className="sticky top-0 z-20 w-full max-w-md mx-auto pt-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-dark/40 z-10" />
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
            placeholder="Search..."
            className="w-full h-9 pl-9 pr-3 rounded-full bg-white/10 border border-white/20 text-on-dark text-body-sm placeholder:text-on-dark/40 outline-none focus:bg-white/15 focus:border-white/30 transition-colors"
          />
        </div>
        </div>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3rem)]">
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
        {showAdminPassword && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-xs w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">Enter admin password</p>
              <p className="text-body-sm text-steel mb-4">{Math.max(0, 3 - adminAttempts)} attempts remaining</p>
              <div className="space-y-3 mb-4">
                <input
                  value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                  type="password"
                  placeholder="••••"
                  className="text-input"
                  autoFocus
                  onKeyDown={async e => {
                    if (e.key !== "Enter") return
                    try {
                      const test = await fetch(`/api/admin/config?export=true&password=${adminPassword}`)
                      if (!test.ok) throw new Error()
                      setShowAdminPassword(false)
                      setAdminError("")
                      go("admin")
                    } catch {
                      setAdminAttempts(p => p + 1)
                      setAdminError("Invalid password")
                    }
                  }}
                />
                {adminError && <p className="text-body-sm text-brand-error">{adminError}</p>}
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => { setShowAdminPassword(false); setAdminError("") }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={async () => {
                  try {
                    const test = await fetch(`/api/admin/config?export=true&password=${adminPassword}`)
                    if (!test.ok) throw new Error()
                    setShowAdminPassword(false)
                    setAdminError("")
                    go("admin")
                  } catch {
                    setAdminAttempts(p => p + 1)
                    setAdminError("Invalid password")
                  }
                }} className="btn-primary flex-1">Submit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (screen === "library") {
    const allItems = [...quizzes, ...crosswords, ...presentations]
    const filtered = allItems.filter(q =>
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
                <button onClick={() => { loadTrash(); go("trash") }} className="btn-icon" title="Trash"><Trash2 size={16} /></button>
                <button onClick={() => go("settings")} className="btn-icon"><Settings size={16} /></button>
              </>
            )}
          </div>
        </header>
        <div className={cn("px-6 pt-5 space-y-4", selectMode && selectedIds.size > 0 ? "pb-20" : "pb-6")}>
          <div className="relative flex gap-2.5">
            <div className="relative flex-1">
              <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="btn-primary w-full flex items-center justify-center gap-1.5"><Plus size={16} /> {t("create")} <ChevronDown size={14} /></button>
              <AnimatePresence>
                {showCreateMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-hairline bg-surface p-1 shadow-lg overflow-hidden"
                    >
                      <motion.button
                        whileHover={{ scale: 1.015, backgroundColor: "rgba(128,128,128,0.08)" }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        onClick={() => { setShowQuizTypeModal(true); setShowCreateMenu(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-body-sm rounded-lg text-ink"
                      >
                        <FileText size={16} /> Quiz
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.015, backgroundColor: "rgba(128,128,128,0.08)" }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        onClick={() => { setShowCrosswordTypeModal(true); setShowCreateMenu(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-body-sm rounded-lg text-ink"
                      >
                        <Grid3x3 size={16} /> Crossword
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.015, backgroundColor: "rgba(128,128,128,0.08)" }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        onClick={() => { setShowPresentationTypeModal(true); setShowCreateMenu(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-body-sm rounded-lg text-ink"
                      >
                        <Presentation size={16} /> Presentation
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.015, backgroundColor: "rgba(128,128,128,0.08)" }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        onClick={() => { setShowArticleModal(true); setShowCreateMenu(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-body-sm rounded-lg text-ink"
                      >
                        <Globe size={16} /> Article
                      </motion.button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <input ref={fileInputRef} onChange={handleUpload} type="file" accept=".pdf,application/pdf,.json" className="hidden" />
            <input ref={slideImageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (!file || !editingSlideId) return
              await handleUploadSlideImage(editingSlideId as Id<"presentationSlides">, file)
              setEditingSlideId(null)
            }} />
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
                    {open && hasQuizzes && fq.map((q) => {
                      const isCrossword = crosswords.some(c => c.id === q.id)
                      const isPresentation = presentations.some(p => p.id === q.id)
                      return (
                      <div
                        key={q.id}
                        draggable={!selectMode}
                        onDragStart={e => handleDragStart(e, q.id, isCrossword ? "crossword" : isPresentation ? "presentation" : "quiz")}
                        onClick={() => {
                          if (selectMode) toggleSelect(q.id)
                          else if (!renamingQuizId) {
                            if (isCrossword) openCrossword(q)
                            else if (isPresentation) openPresentation(q)
                            else openQuiz(q)
                          }
                        }}
                        className={cn("sidebar-item group w-full pl-[18px] rounded-none border-l-0 relative", selectMode && "cursor-pointer")}
                      >
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-px bg-hairline-soft" />
                        {selectMode ? (
                          <button onClick={e => { e.stopPropagation(); toggleSelect(q.id) }} className="shrink-0 mr-1">
                            <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", selectedIds.has(q.id) ? "bg-brand-green border-brand-green" : "border-steel")}>
                              {selectedIds.has(q.id) && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                          </button>
                        ) : isCrossword ? (
                          <Grid3x3 size={14} className="text-amber-500 shrink-0" />
                        ) : isPresentation ? (
                          <Presentation size={14} className="text-blue-500 shrink-0" />
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
                            <button onClick={e => { e.stopPropagation(); isCrossword ? handleDeleteCrossword(q.id) : isPresentation ? handleDeletePresentation(q.id) : handleDeleteQuiz(q.id) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              )
            })}
            {root.map(q => {
              const isCrossword = crosswords.some(c => c.id === q.id)
              const isPresentation = presentations.some(p => p.id === q.id)
              return (
              <div
                key={q.id}
                draggable={!selectMode}
                onDragStart={e => handleDragStart(e, q.id, isCrossword ? "crossword" : isPresentation ? "presentation" : "quiz")}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("bg-surface") }}
                onDragLeave={e => e.currentTarget.classList.remove("bg-surface")}
                onDrop={e => { e.currentTarget.classList.remove("bg-surface"); handleDrop(e, null) }}
                onClick={() => { if (selectMode) toggleSelect(q.id); else if (!renamingQuizId) { if (isCrossword) openCrossword(q); else if (isPresentation) openPresentation(q); else openQuiz(q) } }}
                className={cn("sidebar-item group w-full pl-[26px]", selectMode && "cursor-pointer")}
              >
                {selectMode ? (
                  <button onClick={e => { e.stopPropagation(); toggleSelect(q.id) }} className="shrink-0 mr-1">
                    <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", selectedIds.has(q.id) ? "bg-brand-green border-brand-green" : "border-steel")}>
                      {selectedIds.has(q.id) && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                ) : isCrossword ? (
                  <Grid3x3 size={14} className="text-amber-500 shrink-0" />
                ) : isPresentation ? (
                  <Presentation size={14} className="text-blue-500 shrink-0" />
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
                    <button onClick={e => { e.stopPropagation(); isCrossword ? handleDeleteCrossword(q.id) : isPresentation ? handleDeletePresentation(q.id) : handleDeleteQuiz(q.id) }} className="btn-icon !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            )})}
          </div>
          {selectMode && selectedIds.size > 0 && (
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-canvas border-t border-hairline px-6 py-3 flex gap-2.5 z-40">
              <button onClick={() => setShowDeleteConfirm(true)} className="bg-brand-error text-white rounded-full px-5 py-2.5 text-button-md inline-flex items-center justify-center gap-1.5 flex-1 cursor-pointer"><Trash2 size={14} /> {t("deleteSelected")} ({selectedIds.size})</button>
              <button onClick={() => setShowMoveDialog(true)} className="btn-secondary flex-1"><Folder size={14} /> {t("moveTo")}</button>
            </div>
          )}
        </div>
        <AddQuizModal open={showAddModal || !!clarificationQuestion} folders={folders} onAdd={generateWithAI} onAddFolder={addFolder} onClose={() => { setShowAddModal(false); setClarificationQuestion(null); setPendingGeneration(null) }} t={t} generating={generating} progress={quizGeneratingProgress} clarificationQuestion={clarificationQuestion} onClarify={handleClarify} />
        <UploadModal open={showUploadModal} fileName={pendingFile?.name ?? ""} questionsPerQuiz={uploadQuestionsPerQuiz} onChangeQuestionsPerQuiz={setUploadQuestionsPerQuiz} onConfirm={handleUploadPdf} onClose={() => { setShowUploadModal(false); setPendingFile(null); setUploadProcessing(false); setUploadProgress(""); setUploadLogs([]); setUploadFolderId(null) }} t={t} processing={uploadProcessing} progressLabel={uploadProgress} logs={uploadLogs} folders={folders} folderId={uploadFolderId} onChangeFolder={setUploadFolderId} onAddFolder={addFolder} />
        <PasteQuizModal open={showPasteModal} onClose={() => setShowPasteModal(false)} folders={folders} onAddFolder={addFolder} onPaste={handlePaste} />

        {showQuizTypeModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="card-base max-w-sm w-full p-8"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-body-md-medium text-ink">Create Quiz</p>
                <button onClick={() => setShowQuizTypeModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>
              <p className="text-body-sm text-steel mb-6">Choose how to create your quiz</p>
              <div className="space-y-3.5">
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowQuizTypeModal(false); setShowAddModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 flex items-center justify-center shrink-0 border border-violet-500/10">
                    <Sparkles size={22} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Generate with AI</p>
                    <p className="text-caption text-steel mt-0.5">Describe a topic and get a quiz instantly</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowQuizTypeModal(false); fileInputRef.current?.click() }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center shrink-0 border border-emerald-500/10">
                    <Upload size={22} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Upload PDF</p>
                    <p className="text-caption text-steel mt-0.5">Import questions from a PDF file</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowQuizTypeModal(false); setShowPasteModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 flex items-center justify-center shrink-0 border border-sky-500/10">
                    <FileText size={22} className="text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Paste Content</p>
                    <p className="text-caption text-steel mt-0.5">Paste AI-generated quiz content directly</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
        {showCrosswordTypeModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="card-base max-w-sm w-full p-8"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-body-md-medium text-ink">Create Crossword</p>
                <button onClick={() => setShowCrosswordTypeModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>
              <p className="text-body-sm text-steel mb-6">Choose how to create your crossword</p>
              <div className="space-y-3.5">
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowCrosswordTypeModal(false); setShowCrosswordAddModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center shrink-0 border border-amber-500/10">
                    <Sparkles size={22} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Generate with AI</p>
                    <p className="text-caption text-steel mt-0.5">Describe a topic and get a crossword instantly</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowCrosswordTypeModal(false); setShowCrosswordPasteModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center shrink-0 border border-purple-500/10">
                    <FileText size={22} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">From text</p>
                    <p className="text-caption text-steel mt-0.5">Paste clue: answer pairs to auto-generate a grid</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowCrosswordTypeModal(false); setShowCrosswordManualModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center shrink-0 border border-blue-500/10">
                    <Edit2 size={22} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Clue / Answer / Word</p>
                    <p className="text-caption text-steel mt-0.5">Enter clues and answers manually</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
        {showCrosswordAddModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-sm w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">Generate Crossword</p>
              <p className="text-body-sm text-steel mb-4">Describe your crossword topic</p>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-body-sm font-medium text-ink block mb-1.5">Title</label>
                  <input id="cw-title" value={cwTitle} onChange={e => setCwTitle(e.target.value)} placeholder="e.g. World Capitals" className="text-input" />
                </div>
                <div>
                  <label className="text-body-sm font-medium text-ink block mb-1.5">Description</label>
                  <input id="cw-desc" value={cwDesc} onChange={e => setCwDesc(e.target.value)} placeholder="Optional description" className="text-input" />
                </div>
                <div>
                  <label className="text-body-sm font-medium text-ink block mb-1.5">Difficulty</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                    {cwDifficultyOptions.map(d => (
                      <button key={d.id} type="button" onClick={() => setCwDifficulty(d.id)} className={cn("flex-1 px-3 py-1.5 text-body-sm rounded-md transition-all duration-150", cwDifficulty === d.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-body-sm font-medium text-ink block mb-1.5">Language</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                    {cwLangOptions.map(l => (
                      <button key={l.id} type="button" onClick={() => setCwLanguage(l.id)} className={cn("flex-1 px-3 py-1.5 text-body-sm rounded-md transition-all duration-150", cwLanguage === l.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-body-sm font-medium text-ink block mb-1.5">Words</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={cwWordCount}
                      onChange={e => setCwWordCount(Number(e.target.value))}
                      className="text-input text-body-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => setShowCrosswordAddModal(false)} disabled={generatingCrossword} className={cn("btn-secondary flex-1", generatingCrossword && "opacity-40 cursor-not-allowed")}>Cancel</button>
                <button onClick={() => { if (cwTitle.trim()) generateCrosswordWithAI(cwTitle.trim(), cwDesc.trim(), null, cwDifficulty, cwLanguage, 10, cwWordCount) }} disabled={!cwTitle.trim() || generatingCrossword} className="btn-primary flex-1">
                  {generatingCrossword ? <span className="flex items-center gap-1.5"><Loader size="md" variant="spin" /> Generating…</span> : "Generate"}
                </button>
              </div>
              {generatingCrossword && (
                <div className="mt-3">
                  <div className="flex justify-between text-caption text-steel mb-1">
                    <span>{generatingProgress < 50 ? "AI is thinking..." : generatingProgress < 90 ? "Saving..." : "Done!"}</span>
                    <span>{generatingProgress}%</span>
                  </div>
                  <div className="w-full bg-ink/10 rounded-full h-1.5">
                    <div className="bg-brand-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${generatingProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {showCrosswordManualModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-sm w-full p-6 animate-scale-in max-h-[80vh] flex flex-col">
              <p className="text-body-md-medium text-ink mb-1">Create Crossword</p>
              <p className="text-body-sm text-steel mb-4">Add clues and answers</p>
              <div className="space-y-2 mb-4 shrink-0">
                <input value={cwManualTitle} onChange={e => setCwManualTitle(e.target.value)} placeholder="Crossword title" className="text-input" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
                {cwManualCluesState.map((clue, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-hairline bg-surface space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-muted font-medium">#{idx + 1}</span>
                      <button onClick={() => setCwManualCluesState(p => p.filter((_, i) => i !== idx))} className="text-muted hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={clue.word} onChange={e => { const v = e.target.value.toUpperCase(); setCwManualCluesState(p => p.map((c, i) => i === idx ? { ...c, word: v } : c)) }} placeholder="Answer" className="text-input text-body-sm font-mono" />
                      <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                        {["across", "down"].map(dir => (
                          <button key={dir} type="button" onClick={() => setCwManualCluesState(p => p.map((c, i) => i === idx ? { ...c, direction: dir } : c))} className={cn("flex-1 px-2 py-1 text-caption rounded-md transition-all capitalize", clue.direction === dir ? "bg-surface text-ink font-medium shadow-sm" : "text-muted")}>
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input value={clue.clue} onChange={e => setCwManualCluesState(p => p.map((c, i) => i === idx ? { ...c, clue: e.target.value } : c))} placeholder="Clue text" className="text-input text-body-sm" />
                  </div>
                ))}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCwManualCluesState(p => [...p, { word: "", clue: "", direction: "across", number: p.length + 1 }])}
                  className="flex w-full items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-hairline text-muted hover:text-ink hover:border-ink/30 transition-all text-body-sm"
                >
                  <Plus size={14} /> Add clue
                </motion.button>
              </div>
              <div className="flex gap-2.5 shrink-0">
                <button onClick={() => setShowCrosswordManualModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => { if (cwManualTitle.trim() && cwManualCluesState.some(c => c.word && c.clue)) createManualCrossword(cwManualTitle.trim(), "", null, cwManualCluesState.filter(c => c.word && c.clue).map((c, i) => ({ ...c, number: i + 1, order: i }))) }} disabled={!cwManualTitle.trim() || !cwManualCluesState.some(c => c.word && c.clue)} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        )}
        {showCrosswordPasteModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="card-base max-w-sm w-full p-6 animate-scale-in">
              <p className="text-body-md-medium text-ink mb-1">Create Crossword from Text</p>
              <p className="text-body-sm text-steel mb-4">Paste one clue: answer per line</p>
              <div className="space-y-3 mb-4">
                <input
                  value={crosswordPasteTitle}
                  onChange={e => setCrosswordPasteTitle(e.target.value)}
                  placeholder="Crossword title"
                  className="text-input"
                />
                <textarea
                  value={crosswordPasteText}
                  onChange={e => setCrosswordPasteText(e.target.value)}
                  placeholder={"Capital of France: Paris\nLargest planet: Jupiter\nKing of the gods: Zeus"}
                  className="text-input min-h-[160px] resize-y font-mono text-body-sm"
                  style={{ lineHeight: 1.6 }}
                />
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-body-xs text-steel">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium">Format: <span className="font-mono">clue: ANSWER</span> (one per line)</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          "Capital of France: Paris\nLargest planet: Jupiter\nKing of the gods: Zeus\nGoddess of love: Venus\nRuler of the sea: Neptune"
                        )
                        setCopySampleLabel("Copied!")
                        setTimeout(() => setCopySampleLabel("Copy sample"), 2000)
                      }}
                      className="text-xs text-accent font-medium hover:underline flex items-center gap-1 shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      {copySampleLabel}
                    </button>
                  </div>
                  <pre className="font-mono leading-relaxed text-steel whitespace-pre-wrap">Capital of France: Paris
Largest planet: Jupiter
King of the gods: Zeus
Goddess of love: Venus
Ruler of the sea: Neptune</pre>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => setShowCrosswordPasteModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => {
                    if (crosswordPasteTitle.trim() && crosswordPasteText.trim()) {
                      createCrosswordFromText(crosswordPasteTitle.trim(), crosswordPasteText.trim(), null)
                    }
                  }}
                  disabled={!crosswordPasteTitle.trim() || !crosswordPasteText.trim()}
                  className="btn-primary flex-1"
                >
                  Generate Grid
                </button>
              </div>
            </div>
          </div>
        )}
        {showPresentationTypeModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="card-base max-w-sm w-full p-8"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-body-md-medium text-ink">Create Presentation</p>
                <button onClick={() => setShowPresentationTypeModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>
              <p className="text-body-sm text-steel mb-6">Choose how to create your presentation</p>
              <div className="space-y-3.5">
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowPresentationTypeModal(false); setShowPresentationAddModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center shrink-0 border border-blue-500/10">
                    <Sparkles size={22} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Generate with AI</p>
                    <p className="text-caption text-steel mt-0.5">Describe a topic and get a presentation instantly</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowPresentationTypeModal(false); setShowPresentationTemplateModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center shrink-0 border border-purple-500/10">
                    <FileText size={22} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Use a Template</p>
                    <p className="text-caption text-steel mt-0.5">Start with a pre-made structure, AI fills in content</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowPresentationTypeModal(false); setShowImportTextModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center shrink-0 border border-emerald-500/10">
                    <Import size={22} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Import from Text</p>
                    <p className="text-caption text-steel mt-0.5">Paste text or markdown, AI converts to slides</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setShowPresentationTypeModal(false); setShowArticleModal(true) }}
                  className="flex w-full items-center gap-4 p-5 rounded-2xl border border-hairline bg-surface text-left shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/10 flex items-center justify-center shrink-0 border border-sky-500/10">
                    <Globe size={22} className="text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-ink">Article</p>
                    <p className="text-caption text-steel mt-0.5">AI generates a presentation from a topic</p>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
        {showPresentationTemplateModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="card-base max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-body-md-medium text-ink">Choose a Template</p>
                <button onClick={() => setShowPresentationTemplateModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>
              <p className="text-body-sm text-steel mb-5">Pick a starting structure, then AI fills it with your content</p>
              <div className="grid grid-cols-2 gap-3">
                {presentationTemplates.map((tpl, i) => (
                  <motion.button
                    key={tpl.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    onClick={() => {
                      setShowPresentationTemplateModal(false)
                      setPresTitle(tpl.name)
                      setShowPresentationAddModal(true)
                    }}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-hairline bg-surface text-left hover:border-steel/40 hover:shadow-sm transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                      <FileText size={16} />
                    </div>
                    <div className="w-full">
                      <p className="text-body-sm font-semibold text-ink group-hover:text-brand-primary transition-colors">{tpl.name}</p>
                      <p className="text-caption text-steel mt-0.5 line-clamp-2">{tpl.description}</p>
                    </div>
                    <span className="text-[10px] text-muted">{tpl.slides.length} slides</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
        {showImportTextModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="card-base max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-body-md-medium text-ink">Import from Text</p>
                <button onClick={() => { setShowImportTextModal(false); setImportText("") }} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>
              <p className="text-body-sm text-steel mb-4">Paste your text, notes, or markdown and AI will convert it into a structured presentation</p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"Paste your text here...\n\nTip: You can paste markdown, lecture notes, article text, or any content."}
                className="w-full h-64 px-4 py-3 rounded-xl border border-hairline bg-surface text-ink text-body-sm placeholder:text-muted resize-none focus:outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-caption text-steel">{importText.length.toLocaleString()} characters</span>
                {importText.length > 50000 && <span className="text-caption text-amber-600">Max 50,000 characters</span>}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => { setShowImportTextModal(false); setImportText("") }} disabled={importingText} className="btn-secondary flex-1 !py-2">Cancel</button>
                <button
                  onClick={async () => {
                    if (!importText.trim()) return
                    setImportingText(true)
                    try {
                      const resp = await fetch("/api/ai/convert-text", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: importText.trim(), language: presLanguage || "en" }),
                      })
                      const data = await resp.json()
                      if (!resp.ok) throw new Error(data.error?.message || "Conversion failed")
                      const pres = await createCvxPresentation({
                        title: data.data.title,
                        description: data.data.description,
                        source: "imported_text",
                        theme: presTheme || "claude",
                        size: "16:9",
                        slides: data.data.slides,
                      })
                      setShowImportTextModal(false)
                      setImportText("")
                      setSelectedPresentationId(pres)
                      go("presentation")
                      setShowPresentationTypeModal(false)
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "Failed to import text")
                    } finally {
                      setImportingText(false)
                    }
                  }}
                  disabled={!importText.trim() || importingText || importText.length > 50000}
                  className="btn-primary flex-1 !py-2"
                >
                  {importingText ? <span className="flex items-center gap-1.5"><Loader size="md" variant="spin" /> Converting…</span> : "Convert to Slides"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showArticleModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="card-base max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-body-md-medium text-ink">Article</p>
                <button onClick={() => { setShowArticleModal(false); setArticleTitle("") }} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Title</label>
                  <input
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="e.g. Photosynthesis"
                    className="w-full px-4 py-3 rounded-xl border border-hairline bg-surface text-ink text-body-sm placeholder:text-muted focus:outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all"
                    onKeyDown={(e) => { if (e.key === "Enter" && articleTitle.trim() && !generatingPresentation) { document.getElementById("article-create-btn")?.click() } }}
                  />
                </div>
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Language</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                    {[{ id: "en", label: "English" }, { id: "uz", label: "O'zbek" }, { id: "ru", label: "Русский" }].map(l => (
                      <button
                        key={l.id}
                        onClick={() => setPresLanguage(l.id)}
                        className={cn("flex-1 px-3 py-1.5 text-[11px] rounded-md transition-all", presLanguage === l.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setShowArticleModal(false); setArticleTitle("") }} disabled={generatingPresentation} className="btn-secondary flex-1 !py-2">Cancel</button>
                <button
                  id="article-create-btn"
                  onClick={async () => {
                    if (!articleTitle.trim()) return
                    setShowArticleModal(false)
                    setArticleTitle("")
                    generatePresentationWithAI(articleTitle.trim(), "", null, presLanguage)
                  }}
                  disabled={!articleTitle.trim() || generatingPresentation}
                  className="btn-primary flex-1 !py-2"
                >
                  {generatingPresentation ? <span className="flex items-center gap-1.5"><Loader size="md" variant="spin" /> Generating…</span> : "Create"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {showPresentationAddModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <div className="card-base max-w-md w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-body-md-medium text-ink">Create Presentation</p>
                <button onClick={() => setShowPresentationAddModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Title *</label>
                  <input id="pres-title" value={presTitle} onChange={e => setPresTitle(e.target.value)} placeholder="e.g. Photosynthesis" className="text-input" />
                </div>

                {/* Description */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Description</label>
                  <input id="pres-desc" value={presDesc} onChange={e => setPresDesc(e.target.value)} placeholder="Optional description" className="text-input" />
                </div>

                {/* Language */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Language</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                    {cwLangOptions.map(l => (
                      <button key={l.id} type="button" onClick={() => setPresLanguage(l.id)} className={cn("flex-1 px-3 py-1.5 text-[11px] rounded-md transition-all", presLanguage === l.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Theme</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { id: "claude", color: "#cc785c", label: "Claude" },
                      { id: "apple", color: "#0066cc", label: "Apple" },
                      { id: "hp", color: "#024ad8", label: "HP" },
                      { id: "minimal", color: "#111111", label: "Minimal" },
                      { id: "dark", color: "#a78bfa", label: "Dark" },
                      { id: "gradient", color: "linear-gradient(135deg, #f97316, #ec4899)", label: "Gradient" },
                      { id: "nature", color: "#2d6a4f", label: "Nature" },
                      { id: "neon", color: "#22d3ee", label: "Neon" },
                      { id: "corporate", color: "#1e40af", label: "Corporate" },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setPresTheme(t.id)}
                        className={cn("w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center relative group", presTheme === t.id ? "border-brand-green scale-110" : "border-hairline hover:border-steel")}
                        style={{ background: t.color }}
                        title={t.label}
                      >
                        {presTheme === t.id && <Check size={12} className="text-white drop-shadow-md" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slide Format */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Slide Format</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                    {[
                      { id: "16:9", label: "16:9", desc: "Widescreen" },
                      { id: "4:3", label: "4:3", desc: "Standard" },
                      { id: "9:16", label: "9:16", desc: "Portrait" },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => setPresSize(s.id)}
                        className={cn("flex-1 px-3 py-1.5 text-[11px] rounded-md transition-all flex items-center justify-center gap-1.5", presSize === s.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}
                        title={s.desc}
                      >
                        <span className={cn("w-4 h-3 rounded-sm border", presSize === s.id ? "border-ink/40" : "border-muted/30")} style={{ aspectRatio: s.id === "16:9" ? "16/9" : s.id === "4:3" ? "4/3" : "9/16" }} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Length */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Content Length</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
                    {[
                      { id: "brief", label: "Brief", desc: "15-25 words per slide" },
                      { id: "standard", label: "Standard", desc: "30-50 words per slide" },
                      { id: "detailed", label: "Detailed", desc: "60-90 words per slide" },
                    ].map(d => (
                      <button
                        key={d.id}
                        onClick={() => setPresDensity(d.id)}
                        className={cn("flex-1 px-3 py-1.5 text-[11px] rounded-md transition-all", presDensity === d.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}
                        title={d.desc}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Presentation Style */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Presentation Style</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg flex-wrap">
                    {[
                      { id: "business", label: "Business" },
                      { id: "academic", label: "Academic" },
                      { id: "creative", label: "Creative" },
                      { id: "minimal", label: "Minimal" },
                      { id: "bold", label: "Bold" },
                      { id: "storytelling", label: "Story" },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => setPresStyle(s.id)}
                        className={cn("px-3 py-1.5 text-[11px] rounded-md transition-all", presStyle === s.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Audience</label>
                  <div className="flex gap-1 p-0.5 bg-hairline rounded-lg flex-wrap">
                    {[
                      { id: "general", label: "General" },
                      { id: "students", label: "Students" },
                      { id: "executives", label: "Executives" },
                      { id: "technical", label: "Technical" },
                      { id: "kids", label: "Kids" },
                    ].map(a => (
                      <button
                        key={a.id}
                        onClick={() => setPresAudience(a.id)}
                        className={cn("px-3 py-1.5 text-[11px] rounded-md transition-all", presAudience === a.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slide Count */}
                <div>
                  <label className="micro-uppercase text-steel block mb-1.5">Number of Slides: {presSlideCount}</label>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    value={presSlideCount}
                    onChange={e => setPresSlideCount(Number(e.target.value))}
                    className="w-full h-1.5 bg-hairline rounded-full appearance-none cursor-pointer accent-brand-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted mt-1">
                    <span>5</span>
                    <span>30</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowPresentationAddModal(false)} disabled={generatingPresentation} className={cn("btn-secondary flex-1 !py-2", generatingPresentation && "opacity-40 cursor-not-allowed")}>Cancel</button>
                <button onClick={() => { if (presTitle.trim()) generatePresentationWithAI(presTitle.trim(), presDesc.trim(), null, presLanguage) }} disabled={!presTitle.trim() || generatingPresentation} className="btn-primary flex-1 !py-2">
                  {generatingPresentation ? <span className="flex items-center gap-1.5"><Loader size="md" variant="spin" /> Generating…</span> : "Generate"}
                </button>
              </div>
              {generatingPresentation && (
                <div className="mt-3">
                  <div className="flex justify-between text-caption text-steel mb-1">
                    <span>{presentationProgress < 50 ? "AI is designing your presentation..." : presentationProgress < 90 ? "Almost done..." : "Done!"}</span>
                    <span>{presentationProgress}%</span>
                  </div>
                  <div className="w-full bg-ink/10 rounded-full h-1.5">
                    <div className="bg-brand-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${presentationProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
              <p className="text-body-sm text-steel mb-4">{Math.max(0, 3 - adminAttempts)} attempts remaining</p>
              <div className="space-y-3 mb-4">
                <input
                  value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                  type="password"
                  placeholder="••••"
                  className="text-input"
                  autoFocus
                  onKeyDown={async e => {
                    if (e.key !== "Enter") return
                    try {
                      const test = await fetch(`/api/admin/config?export=true&password=${adminPassword}`)
                      if (!test.ok) throw new Error()
                      setShowAdminPassword(false)
                      setAdminError("")
                      go("admin")
                    } catch {
                      setAdminAttempts(p => p + 1)
                      setAdminError("Invalid password")
                    }
                  }}
                />
                {adminError && <p className="text-body-sm text-brand-error">{adminError}</p>}
              </div>
              <div className="flex gap-2.5">
                <button onClick={() => { setShowAdminPassword(false); setAdminError("") }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={async () => {
                  try {
                    const test = await fetch(`/api/admin/config?export=true&password=${adminPassword}`)
                    if (!test.ok) throw new Error()
                    setShowAdminPassword(false)
                    setAdminError("")
                    go("admin")
                  } catch {
                    setAdminAttempts(p => p + 1)
                    setAdminError("Invalid password")
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
            <button onClick={() => setShowQuizTeachersKey(k => !k)} className={cn("btn-ghost flex-1 border", showQuizTeachersKey ? "border-brand-green text-brand-green" : "border-btn-border")}><span className="text-xs">👁</span> Answer Key</button>
            <button onClick={() => { setTeachersModeQuizId(quiz.id); setShowTeachersMode(true) }} className="btn-ghost flex-1 border border-btn-border"><BarChart3 size={14} /> Teachers</button>
            <button onClick={() => setShowDeleteModal(true)} className="btn-ghost flex-1 border border-btn-border text-brand-error"><Trash2 size={14} /> {t("delete")}</button>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">{t("questions")}</p>
            <div className="space-y-1">
              {allQ.map((q, i) => (
                <div key={q.id} className={cn("rounded-lg transition-all", showQuizTeachersKey && "p-2 bg-surface")}>
                  {showQuizTeachersKey ? (
                    <div>
                      <p className="text-body-sm-medium text-ink mb-1.5">{i + 1}. {q.text}</p>
                      <div className="space-y-0.5 ml-3">
                        {q.options.map((opt, oi) => (
                          <p key={oi} className={cn("text-body-sm", oi === q.correctIndex ? "text-brand-green font-medium" : "text-steel")}>
                            {String.fromCharCode(65 + oi)}. {opt} {oi === q.correctIndex && "✓"}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="sidebar-item">
                      <span className="w-6 h-6 rounded-full bg-surface border border-hairline flex items-center justify-center text-micro shrink-0">{i + 1}</span>
                      <span className="truncate">{q.text}</span>
                    </div>
                  )}
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

        <ShareModal open={showShareModal} quizId={quiz.id} onClose={() => setShowShareModal(false)} t={t} onGenerateLink={async () => {
          if (!convexUserId) throw new Error("Not authenticated")
          const result = await generateCvxShareLink(quiz.id as Id<"quizzes">, convexUserId)
          return `${window.location.origin}/shared/${result.token}`
        }} />

        <TeachersModeModal
          open={showTeachersMode && teachersModeQuizId === quiz.id}
          onClose={() => { setShowTeachersMode(false); setTeachersModeQuizId(null) }}
          stats={teachersModeStats}
          t={t}
        />
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
          <div className="flex items-start justify-between gap-3 mb-6">
            <p className="text-body-md text-ink leading-relaxed flex-1">{curQ.text}</p>
            <button
              onClick={() => setShowFlagModal(true)}
              className={cn(
                "shrink-0 p-1.5 rounded-md transition-colors",
                flaggedQuestions.has(curQ.id)
                  ? "text-brand-error bg-brand-error/10"
                  : "text-steel hover:text-brand-error hover:bg-brand-error/10"
              )}
              title="Flag question"
            >
              <Flag size={16} />
            </button>
          </div>
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
        {showFlagModal && (
          <FlagQuestionModal
            onClose={() => setShowFlagModal(false)}
            onFlag={handleFlagQuestion}
            alreadyFlagged={flaggedQuestions.has(curQ.id)}
            t={t}
          />
        )}
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
          <div className="flex items-start justify-between gap-3 mb-6">
            <p className="text-body-md text-ink leading-relaxed flex-1">{curQ.text}</p>
            <button
              onClick={() => setShowFlagModal(true)}
              className={cn(
                "shrink-0 p-1.5 rounded-md transition-colors",
                flaggedQuestions.has(curQ.id)
                  ? "text-brand-error bg-brand-error/10"
                  : "text-steel hover:text-brand-error hover:bg-brand-error/10"
              )}
              title="Flag question"
            >
              <Flag size={16} />
            </button>
          </div>
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
        {showFlagModal && (
          <FlagQuestionModal
            onClose={() => setShowFlagModal(false)}
            onFlag={handleFlagQuestion}
            alreadyFlagged={flaggedQuestions.has(curQ.id)}
            t={t}
          />
        )}
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

  if (screen === "crossword") {
    const cw = crosswordData as any
    const across = cw?.clues?.filter((c: any) => c.direction === "across") ?? []
    const down = cw?.clues?.filter((c: any) => c.direction === "down") ?? []
    let gw = cw?.gridWidth ?? 10
    let gh = cw?.gridHeight ?? 10

    const grid: Array<Array<{ active: boolean; letter: string; number: number | null; row: number; col: number }>> = Array.from({ length: gh }, (_, r) =>
      Array.from({ length: gw }, (_, c) => ({ active: false, letter: "", number: null, row: r, col: c }))
    )

    const hasPositions = [...across, ...down].some((c: any) => c.row != null && c.col != null)
    if (!hasPositions) {
      let curRow = 0
      for (const clue of [...across, ...down]) {
        const word = (clue.word ?? "").toUpperCase()
        const len = Math.min(word.length, gw)
        clue.row = curRow
        clue.col = 0
        clue.direction = "across"
        for (let i = 0; i < len; i++) {
          grid[curRow][i].active = true
          grid[curRow][i].letter = word[i]
          if (i === 0) grid[curRow][i].number = clue.number
        }
        curRow++
        if (curRow >= gh) break
      }
    } else {
      for (const clue of [...across, ...down]) {
        const word = (clue.word ?? "").toUpperCase()
        for (let i = 0; i < word.length; i++) {
          const r = clue.direction === "down" ? clue.row + i : clue.row
          const c = clue.direction === "across" ? clue.col + i : clue.col
          if (r >= 0 && r < gh && c >= 0 && c < gw) {
            grid[r][c].active = true
            grid[r][c].letter = word[i]
            if (i === 0) grid[r][c].number = clue.number
          }
        }
      }
    }

    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity
    for (let r = 0; r < gh; r++)
      for (let c = 0; c < gw; c++)
        if (grid[r][c].active) {
          if (r < minRow) minRow = r
          if (r > maxRow) maxRow = r
          if (c < minCol) minCol = c
          if (c > maxCol) maxCol = c
        }
    if (minRow !== Infinity) {
      const newH = maxRow - minRow + 1
      const newW = maxCol - minCol + 1
      const newGrid = Array.from({ length: newH }, (_, r) =>
        Array.from({ length: newW }, (_, c) => ({
          ...grid[r + minRow][c + minCol],
          row: r,
          col: c,
        }))
      )
      for (const clue of [...across, ...down]) {
        if (typeof clue.row === "number") clue.row -= minRow
        if (typeof clue.col === "number") clue.col -= minCol
      }
      grid.length = 0
      grid.push(...newGrid)
      gh = newH
      gw = newW
    }

    function getCellKey(r: number, c: number) { return `${r}-${c}` }

    function handleCellClick(r: number, c: number) {
      if (!grid[r][c].active) return
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        setInputDirection(d => d === "across" ? "down" : "across")
      } else {
        setSelectedCell({ row: r, col: c })
      }
    }

    function handleCellInput(r: number, c: number, letter: string) {
      if (!grid[r][c].active) return
      const key = getCellKey(r, c)
      const newGrid = { ...crosswordGridInput, [key]: letter.toUpperCase() }
      setCrosswordGridInput(newGrid)
      setCrosswordChecked({})
      const dir = inputDirection
      let nr = r, nc = c
      if (dir === "across") { nc = c + 1; while (nc < gw && !grid[r][nc].active) nc++ }
      else { nr = r + 1; while (nr < gh && !grid[nr][c].active) nr++ }
      if (nr < gh && nc < gw && grid[nr][nc].active) setSelectedCell({ row: nr, col: nc })
    }

    function handleCellBackspace(r: number, c: number) {
      const key = getCellKey(r, c)
      if (crosswordGridInput[key]) {
        setCrosswordGridInput(p => { const n = { ...p }; delete n[key]; return n })
      } else {
        const dir = inputDirection
        let pr = r, pc = c
        if (dir === "across") { pc = c - 1; while (pc >= 0 && !grid[r][pc].active) pc-- }
        else { pr = r - 1; while (pr >= 0 && !grid[pr][c].active) pr-- }
        if (pr >= 0 && pc >= 0) setSelectedCell({ row: pr, col: pc })
      }
    }

    function handleCheckGrid() {
      const inputKeys = Object.keys(crosswordGridInput)
      const allFilled = [...across, ...down].every((c: any) => {
        const word = (c.word ?? "").toUpperCase()
        for (let i = 0; i < word.length; i++) {
          const r = c.direction === "down" ? c.row + i : c.row
          const col = c.direction === "across" ? c.col + i : c.col
          if (!crosswordGridInput[getCellKey(r, col)]) return false
        }
        return true
      })
      if (!allFilled) { alert("Fill in all cells before checking."); return }
      const checked: Record<string, boolean> = {}
      for (const clue of [...across, ...down]) {
        const word = (clue.word ?? "").toUpperCase()
        let correct = true
        for (let i = 0; i < word.length; i++) {
          const r = clue.direction === "down" ? clue.row + i : clue.row
          const col = clue.direction === "across" ? clue.col + i : clue.col
          if ((crosswordGridInput[getCellKey(r, col)] ?? "") !== word[i]) { correct = false; break }
        }
        checked[`${clue.direction}-${clue.number}`] = correct
      }
      setCrosswordChecked(checked)
    }

    function handleClearGrid() {
      setCrosswordGridInput({})
      setCrosswordChecked({})
      setSelectedCell(null)
    }

    const hasActiveCells = grid.some(r => r.some(c => c.active))
    const cellSize = Math.max(34, Math.min(42, Math.floor((Math.min(640, typeof window !== "undefined" ? window.innerWidth : 640) - 80) / gw)))

    function getClueNumberAt(r: number, c: number, dir: string): number | null {
      if (!grid[r]?.[c]?.active) return null
      if (dir === "across") {
        let s = c; while (s > 0 && grid[r][s - 1].active) s--
        return grid[r][s].number ?? null
      } else {
        let s = r; while (s > 0 && grid[s - 1][c].active) s--
        return grid[s][c].number ?? null
      }
    }
    const activeAcrossNumber = selectedCell ? getClueNumberAt(selectedCell.row, selectedCell.col, "across") : null
    const activeDownNumber = selectedCell ? getClueNumberAt(selectedCell.row, selectedCell.col, "down") : null

    async function handleDownloadPdf() {
      const jsPDF = (await import("jspdf")).default
      if (!cw) return

      const scale = 3
      const cellPx = 28 * scale
      const hairline = Math.max(1, Math.round(0.5 * scale))
      const inset = Math.max(1, Math.round(0.5 * scale))
      const canvasW = gw * cellPx + hairline * 2
      const canvasH = gh * cellPx + hairline * 2

      const canvas = document.createElement("canvas")
      canvas.width = canvasW
      canvas.height = canvasH
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#999"
      ctx.fillRect(0, 0, canvasW, canvasH)

      for (let r = 0; r < gh; r++) {
        for (let c = 0; c < gw; c++) {
          const cell = grid[r][c]
          const x = hairline + c * cellPx
          const y = hairline + r * cellPx
          const size = cellPx - inset * 2
          if (!cell.active) {
            ctx.fillStyle = "#d0cec8"
            ctx.fillRect(x + inset, y + inset, size, size)
          } else {
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(x + inset, y + inset, size, size)
            if (cell.number) {
              ctx.fillStyle = "#888"
              ctx.font = `${Math.round(9 * scale)}px Helvetica, sans-serif`
              ctx.textBaseline = "top"
              ctx.textAlign = "left"
              ctx.fillText(String(cell.number), x + Math.round(2 * scale), y + Math.round(2 * scale))
            }
          }
        }
      }

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = 210
      const pageH = 297
      const margin = 19
      const usableW = pageW - margin * 2
      const title = cw?.title && cw.title.length >= 3 ? cw.title : "Crossword Puzzle"
      const fileName = title.replace(/[^a-zA-Z0-9]/g, "_")

      let y = margin + 4
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(11)
      pdf.setTextColor(102, 102, 102)
      pdf.text("QuizFlow", margin, y)
      y += 8
      pdf.setFont("times", "bold")
      pdf.setFontSize(18)
      pdf.setTextColor(26, 26, 26)
      pdf.text(title, margin, y)
      y += 10

      const imgW = Math.min(usableW, 160)
      const imgH = (canvas.height / canvas.width) * imgW
      if (y + imgH > pageH - margin) { pdf.addPage(); y = margin }
      pdf.addImage(imgData, "PNG", margin, y, imgW, imgH)
      y += imgH + 10

      pdf.setDrawColor(220, 220, 220)
      pdf.line(margin, y, margin + usableW, y)
      y += 6

      const colW = (usableW - 6) / 2
      const colMid = margin + colW + 6

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8.5)
      pdf.setTextColor(153, 153, 153)
      pdf.text("across", margin, y)
      pdf.text("down", colMid, y)
      pdf.setDrawColor(238, 238, 238)
      pdf.line(margin, y + 1, margin + colW, y + 1)
      pdf.line(colMid, y + 1, colMid + colW, y + 1)
      y += 5

      pdf.setFontSize(10)
      pdf.setTextColor(0, 0, 0)

      function writeClues(clues: any[], x: number, maxW: number) {
        let cy = y
        for (const c of clues) {
          if (cy > pageH - margin) { pdf.addPage(); cy = margin }
          pdf.setFont("helvetica", "normal")
          pdf.setTextColor(153, 153, 153)
          const num = `${c.number}.`
          pdf.text(num, x, cy)
          pdf.setTextColor(0, 0, 0)
          const clueX = x + pdf.getTextWidth(num) + 1
          const maxClueW = maxW - (clueX - x) - 4
          const clueText = `${c.clue} (${(c.word ?? "").length})`
          pdf.text(clueText, clueX, cy, { maxWidth: maxClueW })
          cy += 5.5
        }
        return cy
      }

      let acrossEnd = writeClues(across, margin + 1, colW - 1)
      let downEnd = writeClues(down, colMid + 1, colW - 1)
      y = Math.max(acrossEnd, downEnd)

      y += 8
      if (y > pageH - margin) { pdf.addPage(); y = margin + 4 }
      pdf.setDrawColor(230, 230, 230)
      pdf.line(margin, y, margin + usableW, y)
      y += 3
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.5)
      pdf.setTextColor(153, 153, 153)
      pdf.text(title, margin, y)
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      pdf.text(dateStr, margin + usableW, y, { align: "right" })

      pdf.save(`${fileName}.pdf`)
    }

    function printAnswerKey() {
      setShowAnswers(true)
      setTimeout(() => { window.print(); setShowAnswers(false) }, 100)
    }

    function printBlankPuzzle() {
      window.print()
    }

    function ActionsDropdown({ showAnswers, onToggleAnswerKey, onTeachers, onDownloadPdf, onPrint, onPrintKey }: {
      showAnswers: boolean
      onToggleAnswerKey: () => void
      onTeachers: () => void
      onDownloadPdf: () => void
      onPrint: () => void
      onPrintKey: () => void
    }) {
      const [open, setOpen] = useState(false)
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
          if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
      }, [open])
      return (
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(o => !o)} className="btn-icon" title="More actions">
            <MoreVertical size={16} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-hairline bg-surface p-1 shadow-lg">
              <button onClick={() => { onToggleAnswerKey(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-body-sm rounded-lg hover:bg-hairline/50 text-ink transition-colors">
                <span className="text-xs">{showAnswers ? "✓" : ""}</span> Answer Key
              </button>
              <button onClick={() => { onTeachers(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-body-sm rounded-lg hover:bg-hairline/50 text-ink transition-colors">
                <BarChart3 size={15} /> Teachers
              </button>
              <div className="my-1 border-t border-hairline" />
              <button onClick={() => { onDownloadPdf(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-body-sm rounded-lg hover:bg-hairline/50 text-ink transition-colors">
                <Download size={15} /> Download PDF
              </button>
              <button onClick={() => { onPrint(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-body-sm rounded-lg hover:bg-hairline/50 text-ink transition-colors">
                Print
              </button>
              <button onClick={() => { onPrintKey(); setOpen(false) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-body-sm rounded-lg hover:bg-hairline/50 text-ink transition-colors">
                Print Key
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div key="crossword" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up flex flex-col crossword-page">
        <div className="crossword-print-header">
          <div className="crossword-print-brand">
            <svg className="crossword-print-logo" width="22" height="22" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="7" fill="#15803d" />
              <g stroke="white" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M9 7h10l4 4v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" strokeWidth="1.6" />
                <path d="M19 7v4h4" strokeWidth="1.6" />
                <path d="M14 12.5v4m-2-2h4" strokeWidth="1.3" />
                <path d="M9 24q3.5-3 7 0q3.5 3 7 0" strokeWidth="1.5" />
              </g>
            </svg>
            <span className="crossword-print-wordmark">QuizFlow</span>
          </div>
          <h2 className="crossword-print-title">{cw?.title && cw.title.length >= 3 ? cw.title : "Crossword Puzzle"}</h2>
        </div>
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom" onKeyDown={e => {
          if (e.key === "Escape") { setSelectedCell(null); e.currentTarget.blur() }
        }}>
          <button onClick={() => { setSelectedCrosswordId(null); setCrosswordGridInput({}); setCrosswordChecked({}); setSelectedCell(null); go("library") }} className="btn-icon"><ArrowLeft size={16} /></button>
          <Logo size={28} />
          <h2 className="text-heading-5 truncate flex-1">{cw?.title ?? "Crossword"}</h2>
          <button onClick={() => setShowCrosswordShareModal(true)} className="btn-icon" title="Share">
            <Share2 size={16} />
          </button>
        </header>
        {!cw ? (
          <div className="flex items-center justify-center py-20"><Loader size="lg" variant="spin" /></div>
        ) : (
          <div className="px-6 flex-1 flex flex-col items-center gap-6 overflow-y-auto py-6" tabIndex={0} onKeyDown={e => {
            if (!selectedCell) return
            const { row: r, col: c } = selectedCell
            if (e.key === "Tab") { e.preventDefault(); setInputDirection(d => d === "across" ? "down" : "across"); return }
            if (e.key === "Backspace") { handleCellBackspace(r, c); return }
            if (e.key === "Delete") { setCrosswordGridInput(p => { const n = { ...p }; delete n[getCellKey(r, c)]; return n }); return }
            if (e.key === "ArrowRight") { let nc = c + 1; while (nc < gw && !grid[r][nc].active) nc++; if (nc < gw) setSelectedCell({ row: r, col: nc }); return }
            if (e.key === "ArrowLeft") { let nc = c - 1; while (nc >= 0 && !grid[r][nc].active) nc--; if (nc >= 0) setSelectedCell({ row: r, col: nc }); return }
            if (e.key === "ArrowDown") { let nr = r + 1; while (nr < gh && !grid[nr][c].active) nr++; if (nr < gh) setSelectedCell({ row: nr, col: c }); return }
            if (e.key === "ArrowUp") { let nr = r - 1; while (nr >= 0 && !grid[nr][c].active) nr--; if (nr >= 0) setSelectedCell({ row: nr, col: c }); return }
            if (/^[a-zA-Z0-9]$/.test(e.key)) { handleCellInput(r, c, e.key); e.preventDefault() }
          }}>
            <div className="card-base p-5 crossword-card" ref={crosswordGridRef}>
              {!hasActiveCells ? (
                <div className="text-muted text-body-sm py-8 text-center">
                  No grid available for this crossword. Try generating with AI for a visual grid layout.
                </div>
              ) : (
              <div
                 className="crossword-grid rounded-sm shadow-lg"
                 style={{ display: "grid", gridTemplateColumns: `repeat(${gw}, ${cellSize}px)`, width: "fit-content" }}
              >
                {grid.flat().map((cell, idx) => {
                  const { active, letter, number, row, col } = cell
                  const key = getCellKey(row, col)
                  const input = crosswordGridInput[key] ?? ""
                  const sel = selectedCell?.row === row && selectedCell?.col === col
                  const cellWrong = crosswordChecked[`across-${number}`] === false || crosswordChecked[`down-${number}`] === false
                  const cellCorrect = input && (crosswordChecked[`across-${number}`] === true || crosswordChecked[`down-${number}`] === true)
                  const isRightEdge = col === gw - 1 || !grid[row][col + 1]?.active
                  const isBottomEdge = row === gh - 1 || !grid[row + 1]?.[col]?.active
                  return (
                    <div
                      key={idx}
                      className={cn("crossword-cell", !active && "blocked")}
                      onClick={() => !showAnswers && handleCellClick(row, col)}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        fontWeight: 700,
                        fontSize: showAnswers ? 13 : 15,
                        userSelect: "none",
                        backgroundColor: !active ? "#1a1a2e" : showAnswers ? "#ffffff" : sel ? "#dbeafe" : cellCorrect ? "#d1fae5" : cellWrong ? "#fce4ec" : "#f5f4f0",
                        cursor: active && !showAnswers ? "pointer" : "default",
                        zIndex: sel && !showAnswers ? 10 : 0,
                        ...(!active
                          ? { border: "none", borderRadius: 3 }
                          : {
                              borderTop: (row === 0 || !grid[row-1]?.[col]?.active) ? "2px solid #555" : "none",
                              borderLeft: (col === 0 || !grid[row][col-1]?.active) ? "2px solid #555" : "none",
                              borderRight: isRightEdge ? "2px solid #555" : "1px solid rgba(0,0,0,0.12)",
                              borderBottom: isBottomEdge ? "2px solid #555" : "1px solid rgba(0,0,0,0.12)",
                            }),
                      }}
                    >
{active && number && (
                          <span className="crossword-number">{number}</span>
                        )}
                      {active && (
                        <span className="crossword-letter" style={{ letterSpacing: "0.05em", color: "#111", fontWeight: 700, lineHeight: 1 }}>{showAnswers ? (cell.letter || "") : (input || "")}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button onClick={handleCheckGrid} className="btn-primary flex-1">Check Answers</button>
              <button onClick={handleClearGrid} className="btn-secondary flex-1">Clear All</button>
              <ActionsDropdown
                showAnswers={showAnswers}
                onToggleAnswerKey={() => setShowAnswers(s => !s)}
                onTeachers={() => { setTeachersModeCrosswordId(selectedCrosswordId); setShowTeachersMode(true) }}
                onDownloadPdf={handleDownloadPdf}
                onPrint={printBlankPuzzle}
                onPrintKey={printAnswerKey}
              />
            </div>

            <div className="clues-section">
              <div className="grid grid-cols-2 gap-6 clues-grid">
                {across.length > 0 && (
                  <div>
                    <p className="micro-uppercase text-steel mb-3">Across</p>
                    <div className="space-y-2">
                      {across.map((c: any) => (
                        <div key={`across-${c.number}`} className={cn("clue-item px-3 py-2.5 rounded-lg border text-left transition-all", crosswordChecked[`across-${c.number}`] === true ? "border-brand-green bg-brand-green-soft/10" : crosswordChecked[`across-${c.number}`] === false ? "border-brand-error bg-brand-error/5" : activeAcrossNumber === c.number ? "border-brand-green/30 bg-brand-green/5" : "border-hairline bg-surface/50")}>
                          <span className={cn("clue-number", activeAcrossNumber === c.number && "ring-2 ring-brand-green/40 ring-offset-1")}>{c.number}</span>
                          <div className="flex-1 min-w-0 ml-2">
                            <span className="text-body-sm text-ink">{c.clue}</span>
                            <span className="text-caption text-muted ml-1.5">({(c.word ?? "").length})</span>
                          </div>
                          {crosswordChecked[`across-${c.number}`] !== undefined && (
                            <span className={cn("text-caption font-medium shrink-0 ml-2", crosswordChecked[`across-${c.number}`] ? "text-brand-green" : "text-brand-error")}>
                              {crosswordChecked[`across-${c.number}`] ? "✓" : `✗ ${(c.word ?? "").toUpperCase()}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {down.length > 0 && (
                  <div>
                    <p className="micro-uppercase text-steel mb-3">Down</p>
                    <div className="space-y-2">
                      {down.map((c: any) => (
                        <div key={`down-${c.number}`} className={cn("clue-item px-3 py-2.5 rounded-lg border text-left transition-all", crosswordChecked[`down-${c.number}`] === true ? "border-brand-green bg-brand-green-soft/10" : crosswordChecked[`down-${c.number}`] === false ? "border-brand-error bg-brand-error/5" : activeDownNumber === c.number ? "border-brand-green/30 bg-brand-green/5" : "border-hairline bg-surface/50")}>
                          <span className={cn("clue-number", activeDownNumber === c.number && "ring-2 ring-brand-green/40 ring-offset-1")}>{c.number}</span>
                          <div className="flex-1 min-w-0 ml-2">
                            <span className="text-body-sm text-ink">{c.clue}</span>
                            <span className="text-caption text-muted ml-1.5">({(c.word ?? "").length})</span>
                          </div>
                          {crosswordChecked[`down-${c.number}`] !== undefined && (
                            <span className={cn("text-caption font-medium shrink-0 ml-2", crosswordChecked[`down-${c.number}`] ? "text-brand-green" : "text-brand-error")}>
                              {crosswordChecked[`down-${c.number}`] ? "✓" : `✗ ${(c.word ?? "").toUpperCase()}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ShareModal open={showCrosswordShareModal} onClose={() => setShowCrosswordShareModal(false)} t={t} onGenerateLink={async () => {
          if (!convexUserId || !cw) throw new Error("Not authenticated")
          const result = await generateCvxCrosswordShareLink(cw._id as Id<"crosswords">, convexUserId)
          return `${window.location.origin}/shared/${result.token}`
        }} />

        <TeachersModeModal
          open={showTeachersMode && teachersModeCrosswordId === selectedCrosswordId}
          onClose={() => { setShowTeachersMode(false); setTeachersModeCrosswordId(null) }}
          stats={teachersModeStats}
          t={t}
        />
        <div className="crossword-print-footer">
          <span>Crossword Puzzle</span>
          <span>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>
    )
  }

  if (screen === "presentation") {
    const pres = presentationData as any
    if (!pres) {
      return (
        <div key="presentation-loading" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up flex items-center justify-center">
          <Loader size="lg" variant="spin" />
        </div>
      )
    }

    const currentTheme = pres.theme || presTheme || "claude"

    return (
      <div key="presentation" className="h-screen flex flex-col bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 shrink-0 hairline-bottom">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
            <Logo size={28} />
            <h2 className="text-heading-5 truncate">{pres.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative" ref={presLangDropdownRef}>
              <button
                onClick={() => setShowPresLangDropdown(!showPresLangDropdown)}
                className="btn-secondary text-sm !px-2.5 !py-1.5 inline-flex items-center gap-1.5"
              >
                <Languages size={14} />
                <span className="text-xs">{cwLangOptions.find(l => l.id === (pres.language || "en"))?.label || "English"}</span>
                <ChevronDown size={12} />
              </button>
              {showPresLangDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-canvas border border-hairline rounded-lg shadow-lg z-50 py-1 min-w-[140px] animate-slide-down">
                  {cwLangOptions.map(l => (
                    <button
                      key={l.id}
                      onClick={async () => {
                        setShowPresLangDropdown(false)
                        if (l.id === (pres.language || "en")) return
                        if (!confirm(`Regenerate this presentation in ${l.label}? This will replace all current slides.`)) return
                        try {
                          await permanentDeleteCvxPresentations([pres._id])
                          await generateCvxPresentation(
                            convexUserId!,
                            pres.title,
                            pres.description || undefined,
                            pres.folderId,
                            l.id,
                          )
                          go("library")
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Failed to regenerate")
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface transition-colors",
                        (pres.language || "en") === l.id ? "text-ink font-medium bg-surface" : "text-steel"
                      )}
                    >
                      {(pres.language || "en") === l.id && <Check size={14} className="text-brand-green shrink-0" />}
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                const next = !showWatermark
                setShowWatermark(next)
                await updateCvxPresentation(pres._id, { showWatermark: next })
              }}
              className="btn-secondary text-sm !px-2.5 !py-1.5 inline-flex items-center gap-1.5"
              title={showWatermark ? "Hide watermark" : "Show watermark"}
            >
              {showWatermark ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="text-xs">Watermark</span>
            </button>
            <button onClick={handleDownloadPptx} className="btn-primary text-sm !px-3 !py-1.5 inline-flex items-center gap-1.5">
              <Download size={14} /> {t("downloadPptx")}
            </button>
          </div>
        </header>
        <div className="px-6 py-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {pres.description && (
            <p className="text-body-sm text-steel">{pres.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-caption text-muted">
              <Presentation size={14} className="text-blue-500" />
              <span>{pres.slides?.length ?? 0} {t("slides")}</span>
            </div>
            <div className="flex items-center gap-1">
              {([
                { id: "claude", color: "#cc785c" },
                { id: "apple", color: "#0066cc" },
                { id: "hp", color: "#024ad8" },
                { id: "minimal", color: "#111111" },
                { id: "dark", color: "#a78bfa" },
                { id: "gradient", color: "linear-gradient(135deg, #f97316, #ec4899)" },
                { id: "nature", color: "#2d6a4f" },
                { id: "neon", color: "#22d3ee" },
                { id: "corporate", color: "#1e40af" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={async () => {
                    setPresTheme(t.id)
                    await updateCvxPresentation(pres._id, { theme: t.id })
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    currentTheme === t.id ? "border-brand-green scale-110" : "border-hairline hover:border-steel"
                  )}
                  style={{ background: t.color }}
                  title={t.id}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {pres.slides?.map((slide: any, idx: number) => {
              const isTitle = slide.layout === "title"
              const isSection = slide.layout === "sectionDivider"
              const isStats = slide.layout === "stats"
              const isQuote = slide.layout === "quote"
              const isTwoCol = slide.layout === "twoColumn" && slide.content.length === 2
              const isTimeline = slide.layout === "timeline"
              const isComparison = slide.layout === "comparison"
              const isNumberedSteps = slide.layout === "numberedSteps"
              const isClosing = slide.layout === "closing"
              const themeStyles: Record<string, { bg: string; titleFont: string; bodyFont: string; titleColor: string; bodyColor: string; accent: string; mutedColor: string; cardBg: string; stripBg: string; accentLight: string }> = {
                claude: { bg: "bg-[#faf9f5]", titleFont: "font-serif", bodyFont: "", titleColor: "text-[#141413]", bodyColor: "text-[#3d3d3a]", accent: "#cc785c", mutedColor: "text-[#6c6a64]", cardBg: "bg-[#181715]", stripBg: "bg-[#cc785c]", accentLight: "bg-[#e8c4b0]" },
                apple: { bg: "bg-white", titleFont: "font-semibold tracking-tight", bodyFont: "", titleColor: "text-[#1d1d1f]", bodyColor: "text-[#333333]", accent: "#0066cc", mutedColor: "text-[#6e6e73]", cardBg: "bg-[#f5f5f7]", stripBg: "bg-[#0066cc]", accentLight: "bg-[#d6eaff]" },
                hp: { bg: "bg-white", titleFont: "font-medium", bodyFont: "", titleColor: "text-[#1a1a1a]", bodyColor: "text-[#333333]", accent: "#024ad8", mutedColor: "text-[#636363]", cardBg: "bg-[#f0f4ff]", stripBg: "bg-[#024ad8]", accentLight: "bg-[#d6deff]" },
                minimal: { bg: "bg-white", titleFont: "font-semibold", bodyFont: "", titleColor: "text-[#111111]", bodyColor: "text-[#333333]", accent: "#111111", mutedColor: "text-[#888888]", cardBg: "bg-[#f5f5f5]", stripBg: "bg-[#111111]", accentLight: "bg-[#e5e5e5]" },
                dark: { bg: "bg-[#0f0f0f]", titleFont: "font-semibold", bodyFont: "", titleColor: "text-white", bodyColor: "text-white/80", accent: "#a78bfa", mutedColor: "text-white/50", cardBg: "bg-white/5", stripBg: "bg-[#a78bfa]", accentLight: "bg-[#a78bfa]/20" },
                gradient: { bg: "bg-gradient-to-br from-orange-50 to-pink-50", titleFont: "font-bold", bodyFont: "", titleColor: "text-[#1a1a1a]", bodyColor: "text-[#333333]", accent: "#f97316", mutedColor: "text-[#666666]", cardBg: "bg-white/70", stripBg: "bg-gradient-to-r from-[#f97316] to-[#ec4899]", accentLight: "bg-orange-100" },
                nature: { bg: "bg-[#f5f0e8]", titleFont: "font-serif", bodyFont: "", titleColor: "text-[#1a2e1a]", bodyColor: "text-[#2d3a2d]", accent: "#2d6a4f", mutedColor: "text-[#5a6b5a]", cardBg: "bg-[#e8e0d0]", stripBg: "bg-[#2d6a4f]", accentLight: "bg-[#d4e8dc]" },
                neon: { bg: "bg-[#0a0a0a]", titleFont: "font-bold", bodyFont: "", titleColor: "text-white", bodyColor: "text-white/80", accent: "#22d3ee", mutedColor: "text-white/50", cardBg: "bg-white/5", stripBg: "bg-[#22d3ee]", accentLight: "bg-[#22d3ee]/15" },
                corporate: { bg: "bg-[#f8fafc]", titleFont: "font-semibold", bodyFont: "", titleColor: "text-[#0f172a]", bodyColor: "text-[#334155]", accent: "#1e40af", mutedColor: "text-[#64748b]", cardBg: "bg-[#e2e8f0]", stripBg: "bg-[#1e40af]", accentLight: "bg-[#dbeafe]" },
              }
              const ts = themeStyles[currentTheme] || themeStyles.claude
              const isEditingTitle = editingSlideContentId === slide._id && editingSlideField === "title"
              const isEditingContent = editingSlideContentId === slide._id && editingSlideField === "content"

              return (
                <motion.div
                  key={slide._id}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, delay: idx * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="group relative"
                >
                  {/* Slide number badge */}
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface border border-hairline text-[9px] font-medium text-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {idx + 1}
                  </div>

                  <div className={cn("rounded-xl border border-hairline overflow-hidden shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-steel/30 group-hover:scale-[1.01]", ts.bg)}>
                  {/* Slide controls */}
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    {idx > 0 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const sorted = [...pres.slides].sort((a: any, b: any) => a.order - b.order)
                          const ids = sorted.map((s: any) => s._id as Id<"presentationSlides">)
                          ;[ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]]
                          await reorderCvxSlides(ids)
                        }}
                        className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-all duration-150"
                        title="Move up"
                      ><ChevronUp size={14} /></button>
                    )}
                    {idx < pres.slides.length - 1 && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const sorted = [...pres.slides].sort((a: any, b: any) => a.order - b.order)
                          const ids = sorted.map((s: any) => s._id as Id<"presentationSlides">)
                          ;[ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]
                          await reorderCvxSlides(ids)
                        }}
                        className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-all duration-150"
                        title="Move down"
                      ><ChevronDown size={14} /></button>
                    )}
                    <select
                      value={slide.layout}
                      onChange={async (e) => {
                        await updateCvxSlide(slide._id, { layout: e.target.value })
                      }}
                      className="h-7 text-[10px] rounded-lg bg-black/60 backdrop-blur-sm text-white border-none px-1.5 cursor-pointer appearance-none"
                    >
                      <option value="title">Title</option>
                      <option value="titleContent">Content</option>
                      <option value="twoColumn">Two Column</option>
                      <option value="sectionDivider">Section</option>
                      <option value="stats">Stats</option>
                      <option value="quote">Quote</option>
                      <option value="timeline">Timeline</option>
                      <option value="comparison">Comparison</option>
                      <option value="imageFocused">Image Focus</option>
                      <option value="numberedSteps">Steps</option>
                      <option value="closing">Closing</option>
                      <option value="blank">Blank</option>
                    </select>
                    <select
                      value={slide.fontSize || "md"}
                      onChange={async (e) => {
                        await updateCvxSlide(slide._id, { fontSize: e.target.value })
                      }}
                      className="h-7 text-[10px] rounded-lg bg-black/60 backdrop-blur-sm text-white border-none px-1.5 cursor-pointer appearance-none"
                      title="Font size"
                    >
                      <option value="xs">XS</option>
                      <option value="sm">SM</option>
                      <option value="md">MD</option>
                      <option value="lg">LG</option>
                      <option value="xl">XL</option>
                    </select>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm("Delete this slide?")) {
                          await deleteCvxSlide(slide._id)
                        }
                      }}
                      className="w-7 h-7 rounded-lg bg-red-500/70 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-600 transition-all duration-150"
                      title="Delete slide"
                    ><X size={12} /></button>
                  </div>

                  {/* Theme top strip */}
                  {currentTheme === "claude" && (
                    <div className={cn("h-1.5", ts.stripBg)} />
                  )}
                  {currentTheme === "hp" && (
                    <div className={cn("h-6 flex items-center gap-1 px-3", ts.stripBg)}>
                      <div className="w-1 h-3 bg-white/40 rounded-full" />
                      <div className="w-1 h-3 bg-white/40 rounded-full" />
                      <div className="flex-1" />
                      <span className="text-[8px] text-white/80 font-medium uppercase" style={{ letterSpacing: "0.5px" }}>HP</span>
                    </div>
                  )}
                  {currentTheme === "apple" && (
                    <div className="h-1 bg-[#0066cc]" />
                  )}
                  {currentTheme === "minimal" && (
                    <div className="h-0.5 bg-[#111111]" />
                  )}
                  {currentTheme === "dark" && (
                    <div className="h-1.5 bg-[#a78bfa]" />
                  )}
                  {currentTheme === "gradient" && (
                    <div className="h-1.5 bg-gradient-to-r from-[#f97316] to-[#ec4899]" />
                  )}
                  {currentTheme === "nature" && (
                    <div className="h-1.5 bg-[#2d6a4f]" />
                  )}
                  {currentTheme === "neon" && (
                    <div className="h-1.5 bg-[#22d3ee]" />
                  )}
                  {currentTheme === "corporate" && (
                    <div className="h-1 bg-[#1e40af]" />
                  )}

                  {/* TITLE SLIDE */}
                  {isTitle && (
                    <div className="relative px-5 pt-8 pb-6">
                      {currentTheme === "claude" && (
                        <>
                          <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-[#e8c4b0]/30" />
                          <div className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-[#e8c4b0]/20" />
                          <div className="rounded-xl px-5 py-4 bg-[#181715]">
                            <div className="w-8 h-0.5 bg-[#cc785c] rounded mb-3" />
                            {isEditingTitle ? (
                              <input
                                autoFocus
                                value={editingSlideValue}
                                onChange={e => setEditingSlideValue(e.target.value)}
                                onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                                onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                                className="text-base font-bold text-white bg-transparent border-b border-[#cc785c] outline-none w-full mb-1"
                              />
                            ) : (
                              <div
                                className={cn("text-base font-bold text-white mb-1 cursor-text hover:underline decoration-dotted", ts.titleFont)}
                                onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                              >{slide.title}</div>
                            )}
                            {slide.content.length > 0 && (
                              isEditingContent ? (
                                <textarea
                                  autoFocus
                                  value={editingSlideValue}
                                  onChange={e => setEditingSlideValue(e.target.value)}
                                  onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                                  className="text-[11px] text-[#cc785c] bg-transparent border-b border-[#cc785c] outline-none w-full resize-none"
                                  rows={2}
                                />
                              ) : (
                                <div
                                  className="text-[11px] text-[#cc785c] cursor-text hover:underline decoration-dotted"
                                  onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                                >{slide.content[0]}</div>
                              )
                            )}
                          </div>
                        </>
                      )}
                      {currentTheme === "apple" && (
                        <>
                          <div className="absolute top-3 right-3 w-24 h-24 rounded-full bg-[#d6eaff]/40" />
                          <div className="w-6 h-0.5 bg-[#0066cc] rounded mb-3" />
                          {isEditingTitle ? (
                            <input
                              autoFocus
                              value={editingSlideValue}
                              onChange={e => setEditingSlideValue(e.target.value)}
                              onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                              onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                              className={cn("text-base font-bold mb-1 relative z-10 bg-transparent border-b border-[#0066cc] outline-none w-full", ts.titleColor)}
                            />
                          ) : (
                            <div
                              className={cn("text-base font-bold mb-1 relative z-10 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)}
                              onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                            >{slide.title}</div>
                          )}
                          {slide.content.length > 0 && (
                            isEditingContent ? (
                              <textarea
                                autoFocus
                                value={editingSlideValue}
                                onChange={e => setEditingSlideValue(e.target.value)}
                                onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                                className={cn("text-[11px] mt-1 relative z-10 bg-transparent border-b border-[#0066cc] outline-none w-full resize-none", ts.mutedColor)}
                                rows={2}
                              />
                            ) : (
                              <div
                                className={cn("text-[11px] mt-1 relative z-10 cursor-text hover:underline decoration-dotted", ts.mutedColor)}
                                onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                              >{slide.content[0]}</div>
                            )
                          )}
                        </>
                      )}
                      {currentTheme === "hp" && (
                        <>
                          <div className="absolute top-4 left-0 w-5 h-16 bg-[#024ad8]/10 rounded-r" style={{ transform: "rotate(12deg)" }} />
                          <div className="absolute top-4 right-0 w-5 h-16 bg-[#024ad8]/10 rounded-l" style={{ transform: "rotate(-12deg)" }} />
                          {isEditingTitle ? (
                            <input
                              autoFocus
                              value={editingSlideValue}
                              onChange={e => setEditingSlideValue(e.target.value)}
                              onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                              onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                              className={cn("text-base font-bold mb-1 relative z-10 bg-transparent border-b border-[#024ad8] outline-none w-full", ts.titleColor)}
                            />
                          ) : (
                            <div
                              className={cn("text-base font-bold mb-1 relative z-10 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)}
                              onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                            >{slide.title}</div>
                          )}
                          {slide.content.length > 0 && (
                            isEditingContent ? (
                              <textarea
                                autoFocus
                                value={editingSlideValue}
                                onChange={e => setEditingSlideValue(e.target.value)}
                                onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                                className={cn("text-[11px] mt-1 relative z-10 bg-transparent border-b border-[#024ad8] outline-none w-full resize-none", ts.mutedColor)}
                                rows={2}
                              />
                            ) : (
                              <div
                                className={cn("text-[11px] mt-1 relative z-10 cursor-text hover:underline decoration-dotted", ts.mutedColor)}
                                onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                              >{slide.content[0]}</div>
                            )
                          )}
                          <div className="w-12 h-0.5 bg-[#024ad8] rounded mt-2" />
                        </>
                      )}
                    </div>
                  )}

                  {/* SECTION DIVIDER */}
                  {isSection && (
                    <div className={cn("relative px-5 pt-8 pb-6", currentTheme === "claude" && "bg-[#a8553a]", currentTheme === "apple" && "bg-[#0066cc]", currentTheme === "hp" && "bg-[#024ad8]")}>
                      {currentTheme === "claude" && (
                        <>
                          <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/15" />
                          <div className="absolute bottom-4 left-8 w-8 h-8 rounded-full bg-white/10" />
                        </>
                      )}
                      {currentTheme === "apple" && (
                        <div className="absolute top-3 right-3 w-20 h-20 rounded-full bg-white/10" />
                      )}
                      {currentTheme === "hp" && (
                        <>
                          <div className="absolute top-3 left-0 right-0 h-px bg-white/20" />
                          <div className="absolute bottom-3 left-0 right-0 h-px bg-white/20" />
                        </>
                      )}
                      {isEditingTitle ? (
                        <input
                          autoFocus
                          value={editingSlideValue}
                          onChange={e => setEditingSlideValue(e.target.value)}
                          onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                          onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                          className="text-base font-bold text-white relative z-10 bg-transparent border-b border-white/50 outline-none w-full"
                        />
                      ) : (
                        <div
                          className="text-base font-bold text-white relative z-10 cursor-text hover:underline decoration-dotted"
                          onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                        >{slide.title}</div>
                      )}
                      {slide.content.length > 0 && (
                        isEditingContent ? (
                          <textarea
                            autoFocus
                            value={editingSlideValue}
                            onChange={e => setEditingSlideValue(e.target.value)}
                            onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                            className="text-[11px] text-white mt-1 relative z-10 bg-transparent border-b border-white/50 outline-none w-full resize-none"
                            rows={2}
                          />
                        ) : (
                          <div
                            className="text-[11px] text-white mt-1 relative z-10 cursor-text hover:underline decoration-dotted"
                            onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                          >{slide.content[0]}</div>
                        )
                      )}
                    </div>
                  )}

                  {/* STATS SLIDE */}
                  {isStats && (
                    <div className="px-5 pt-4 pb-4">
                      {isEditingTitle ? (
                        <input
                          autoFocus
                          value={editingSlideValue}
                          onChange={e => setEditingSlideValue(e.target.value)}
                          onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                          onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                          className={cn("text-xs font-bold mb-2 bg-transparent border-b outline-none w-full", ts.titleColor, currentTheme === "claude" ? "border-[#cc785c]" : "border-[#0066cc]")}
                        />
                      ) : (
                        <div
                          className={cn("text-xs font-bold mb-2 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)}
                          onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                        >{slide.title}</div>
                      )}
                      <div className="h-px mb-3" style={{ backgroundColor: ts.accent }} />
                      <div className="grid grid-cols-2 gap-2">
                        {slide.content.filter((c: string) => c.includes("|")).slice(0, 4).map((stat: string, i: number) => {
                          const [num, label] = stat.split("|")
                          return (
                            <div key={i} className={cn("rounded-lg px-3 py-3 text-center", currentTheme === "claude" ? "bg-[#181715]" : (i % 2 === 0 ? ts.accentLight : ts.cardBg))}>
                              <div className={cn("text-xl font-bold", currentTheme === "claude" ? "text-[#cc785c]" : "")} style={currentTheme !== "claude" ? { color: ts.accent } : undefined}>{num}</div>
                              <div className={cn("text-[9px] mt-1 leading-tight", currentTheme === "claude" ? "text-white/80" : ts.mutedColor)}>{label}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* QUOTE SLIDE */}
                  {isQuote && (
                    <div className="px-5 pt-5 pb-4">
                      {currentTheme === "claude" && (
                        <>
                          <div className="text-5xl font-serif text-[#e8c4b0]/60 leading-none mb-1">{"\u201C"}</div>
                          {isEditingContent ? (
                            <textarea
                              autoFocus
                              value={editingSlideValue}
                              onChange={e => setEditingSlideValue(e.target.value)}
                              onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                              className="text-[11px] italic text-[#141413] leading-relaxed pl-2 bg-transparent border-b border-[#cc785c] outline-none w-full resize-none"
                              rows={3}
                            />
                          ) : (
                            <div
                              className="text-[11px] italic text-[#141413] leading-relaxed pl-2 cursor-text hover:underline decoration-dotted"
                              onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                            >{slide.content[0]}</div>
                          )}
                          {slide.content.length > 1 && (
                            <>
                              <div className="w-8 h-px bg-[#cc785c] mt-3 mb-1" />
                              <div className="text-[9px] text-[#6c6a64] pl-2">{slide.content[1]}</div>
                            </>
                          )}
                        </>
                      )}
                      {currentTheme === "apple" && (
                        <div className="flex gap-2">
                          <div className="w-1 bg-[#0066cc] rounded-full shrink-0" />
                          <div>
                            {isEditingContent ? (
                              <textarea
                                autoFocus
                                value={editingSlideValue}
                                onChange={e => setEditingSlideValue(e.target.value)}
                                onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                                className="text-[11px] italic text-[#1d1d1f] leading-relaxed bg-transparent border-b border-[#0066cc] outline-none w-full resize-none"
                                rows={3}
                              />
                            ) : (
                              <div
                                className="text-[11px] italic text-[#1d1d1f] leading-relaxed cursor-text hover:underline decoration-dotted"
                                onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                              >{slide.content[0]}</div>
                            )}
                            {slide.content.length > 1 && (
                              <div className="text-[9px] text-[#0066cc] font-medium mt-2">{slide.content[1]}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {currentTheme === "hp" && (
                        <div className="flex gap-2">
                          <div className="w-1 bg-[#024ad8] rounded-full shrink-0" />
                          <div>
                            {isEditingContent ? (
                              <textarea
                                autoFocus
                                value={editingSlideValue}
                                onChange={e => setEditingSlideValue(e.target.value)}
                                onBlur={async () => { await updateCvxSlide(slide._id, { content: [editingSlideValue, ...slide.content.slice(1)] }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                                className="text-[11px] italic text-[#1a1a1a] leading-relaxed bg-transparent border-b border-[#024ad8] outline-none w-full resize-none"
                                rows={3}
                              />
                            ) : (
                              <div
                                className="text-[11px] italic text-[#1a1a1a] leading-relaxed cursor-text hover:underline decoration-dotted"
                                onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("content"); setEditingSlideValue(slide.content[0] || "") }}
                              >{slide.content[0]}</div>
                            )}
                            {slide.content.length > 1 && (
                              <div className="text-[9px] text-[#024ad8] font-medium mt-2">{slide.content[1]}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TIMELINE */}
                  {isTimeline && (
                    <div className="px-5 pt-4 pb-4">
                      {isEditingTitle ? (
                        <input autoFocus value={editingSlideValue} onChange={e => setEditingSlideValue(e.target.value)} onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }} className={cn("text-xs font-bold mb-2 bg-transparent border-b outline-none w-full", ts.titleColor, currentTheme === "claude" ? "border-[#cc785c]" : "border-[#0066cc]")} />
                      ) : (
                        <div className={cn("text-xs font-bold mb-2 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)} onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}>{slide.title}</div>
                      )}
                      <div className="h-px mb-3" style={{ backgroundColor: ts.accent }} />
                      <div className="space-y-2">
                        {slide.content.slice(0, 5).map((item: string, i: number) => {
                          const [year, ...eventParts] = item.split("|")
                          return (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-bold text-white" style={{ backgroundColor: ts.accent }}>{year}</div>
                              <div className={cn("flex-1 rounded-lg px-3 py-2 text-[10px]", ts.cardBg, ts.bodyColor)}>{eventParts.join("|")}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* COMPARISON */}
                  {isComparison && (
                    <div className="px-5 pt-4 pb-4">
                      {isEditingTitle ? (
                        <input autoFocus value={editingSlideValue} onChange={e => setEditingSlideValue(e.target.value)} onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }} className={cn("text-xs font-bold mb-2 bg-transparent border-b outline-none w-full", ts.titleColor, currentTheme === "claude" ? "border-[#cc785c]" : "border-[#0066cc]")} />
                      ) : (
                        <div className={cn("text-xs font-bold mb-2 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)} onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}>{slide.title}</div>
                      )}
                      <div className="h-px mb-3" style={{ backgroundColor: ts.accent }} />
                      <div className="grid grid-cols-2 gap-2">
                        {slide.content.slice(0, 2).map((col: string, i: number) => {
                          const [colTitle, ...items] = col.split("|")
                          return (
                            <div key={i} className={cn("rounded-lg px-3 py-2", i === 0 ? ts.cardBg : ts.accentLight)}>
                              <div className="text-[9px] font-bold mb-1" style={{ color: ts.accent }}>{colTitle}</div>
                              {items.join("|").split("\\n").slice(0, 3).map((item: string, j: number) => (
                                <div key={j} className="text-[9px] flex items-start gap-1 mb-1 last:mb-0"><span style={{ color: ts.accent }}>•</span><span className={cn("leading-snug", ts.bodyColor)}>{item}</span></div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* NUMBERED STEPS */}
                  {isNumberedSteps && !isTitle && !isSection && !isStats && !isQuote && !isTwoCol && (
                    <div className="px-5 pt-4 pb-4">
                      {isEditingTitle ? (
                        <input autoFocus value={editingSlideValue} onChange={e => setEditingSlideValue(e.target.value)} onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }} className={cn("text-xs font-bold mb-2 bg-transparent border-b outline-none w-full", ts.titleColor, currentTheme === "claude" ? "border-[#cc785c]" : "border-[#0066cc]")} />
                      ) : (
                        <div className={cn("text-xs font-bold mb-2 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)} onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}>{slide.title}</div>
                      )}
                      <div className="h-px mb-3" style={{ backgroundColor: ts.accent }} />
                      <div className="space-y-2">
                        {slide.content.slice(0, 5).map((point: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: ts.accent }}>{i + 1}</div>
                            <div className={cn("flex-1 rounded-lg px-3 py-2 text-[10px]", ts.cardBg, ts.bodyColor)}>{point}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CLOSING */}
                  {isClosing && (
                    <div className={cn("px-5 pt-6 pb-4 text-center", currentTheme === "claude" && "bg-[#a8553a]", currentTheme === "apple" && "bg-[#0066cc]", currentTheme === "hp" && "bg-[#024ad8]", currentTheme === "dark" && "bg-[#1a1a2e]", currentTheme === "neon" && "bg-[#0a1628]", currentTheme === "corporate" && "bg-[#1e293b]", (currentTheme === "minimal" || currentTheme === "nature" || currentTheme === "gradient") && ts.stripBg)}>
                      <div className="text-base font-bold text-white mb-2">{slide.title}</div>
                      {slide.content.length > 0 && <div className="text-[10px] text-white/80">{slide.content[0]}</div>}
                      {slide.content.length > 1 && <div className="text-[9px] text-white/60 mt-1">{slide.content[1]}</div>}
                    </div>
                  )}

                  {/* TWO COLUMN */}
                  {!isTitle && !isSection && !isStats && !isQuote && isTwoCol && (
                    <div className="px-5 pt-4 pb-4">
                      {isEditingTitle ? (
                        <input
                          autoFocus
                          value={editingSlideValue}
                          onChange={e => setEditingSlideValue(e.target.value)}
                          onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                          onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                          className={cn("text-xs font-bold mb-2 bg-transparent border-b outline-none w-full", ts.titleColor, currentTheme === "claude" ? "border-[#cc785c]" : "border-[#0066cc]")}
                        />
                      ) : (
                        <div
                          className={cn("text-xs font-bold mb-2 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)}
                          onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                        >{slide.title}</div>
                      )}
                      <div className="h-px mb-3" style={{ backgroundColor: ts.accent }} />
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1].map(col => (
                          <div key={col} className={cn("rounded-lg px-3 py-2", ts.cardBg)}>
                            <div className="w-4 h-0.5 rounded-full mb-2" style={{ backgroundColor: ts.accent }} />
                            <div className={cn("text-[10px] leading-relaxed", ts.bodyColor)}>
                              {(slide.content[col] || "").split("\n").map((line: string, li: number) => (
                                <div key={li} className="mb-1">{line}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TITLE CONTENT / BLANK (default) */}
                  {!isTitle && !isSection && !isStats && !isQuote && !isTwoCol && !isTimeline && !isComparison && !isNumberedSteps && !isClosing && (
                    <div className="px-5 pt-4 pb-4">
                      {isEditingTitle ? (
                        <input
                          autoFocus
                          value={editingSlideValue}
                          onChange={e => setEditingSlideValue(e.target.value)}
                          onBlur={async () => { await updateCvxSlide(slide._id, { title: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                          onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur() } }}
                          className={cn("text-xs font-bold mb-2 bg-transparent border-b outline-none w-full", ts.titleColor, currentTheme === "claude" ? "border-[#cc785c]" : "border-[#0066cc]")}
                        />
                      ) : (
                        <div
                          className={cn("text-xs font-bold mb-2 cursor-text hover:underline decoration-dotted", ts.titleFont, ts.titleColor)}
                          onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("title"); setEditingSlideValue(slide.title) }}
                        >{slide.title}</div>
                      )}
                      <div className="h-px mb-3" style={{ backgroundColor: ts.accent }} />
                      {currentTheme === "hp" && (
                        <div className={cn("rounded-lg px-3 py-2 -mx-1", ts.cardBg)}>
                          {slide.content.slice(0, 5).map((point: string, i: number) => (
                            <div key={i} className={cn("text-[10px] flex items-start gap-1.5 mb-1.5 last:mb-0", ts.bodyColor)}>
                              <span style={{ color: ts.accent }} className="mt-px shrink-0">•</span>
                              <span className="leading-snug">{point}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {currentTheme !== "hp" && currentTheme === "claude" && (
                        <div className={cn("rounded-lg px-3 py-2 -mx-1", ts.cardBg)}>
                          {slide.content.slice(0, 5).map((point: string, i: number) => (
                            <div key={i} className="text-[10px] flex items-start gap-1.5 mb-1.5 last:mb-0 text-white/90">
                              <span className="text-[#cc785c] mt-px shrink-0">•</span>
                              <span className="leading-snug">{point}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {currentTheme === "apple" && slide.content.slice(0, 5).map((point: string, i: number) => (
                        <div key={i} className={cn("text-[10px] flex items-start gap-1.5 mb-1.5 last:mb-0", ts.bodyColor)}>
                          <span className="mt-px shrink-0 w-1 h-1 rounded-full" style={{ backgroundColor: ts.accent, marginTop: "4px" }} />
                          <span className="leading-snug">{point}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Image */}
                  {slide.imageUrl && (
                    <div className="px-5 pb-2">
                      <div className="relative rounded-lg overflow-hidden">
                        <img src={slide.imageUrl} alt="" className="w-full h-32 object-cover" />
                        <button
                          onClick={() => handleRemoveSlideImage(slide._id)}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                          title={t("removeImage")}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add image button */}
                  {!isTitle && !isSection && !slide.imageUrl && (
                    <div className="px-5 pb-2">
                      <button
                        onClick={() => { setEditingSlideId(slide._id); slideImageInputRef.current?.click() }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-hairline text-[9px] text-muted hover:text-ink hover:border-steel transition-colors"
                      >
                        <ImagePlus size={12} /> {t("addImage")}
                      </button>
                    </div>
                  )}

                  {/* Speaker Notes */}
                  <div className="px-5 pb-2">
                    {editingSlideContentId === slide._id && editingSlideField === "speakerNotes" ? (
                      <textarea
                        autoFocus
                        value={editingSlideValue}
                        onChange={e => setEditingSlideValue(e.target.value)}
                        onBlur={async () => { await updateCvxSlide(slide._id, { speakerNotes: editingSlideValue }); setEditingSlideContentId(null); setEditingSlideField(null) }}
                        placeholder="Speaker notes (visible only in presenter mode)"
                        className="w-full text-[9px] text-muted bg-hairline/50 rounded-lg px-3 py-2 border border-hairline outline-none resize-none focus:border-brand-primary/50"
                        rows={3}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingSlideContentId(slide._id); setEditingSlideField("speakerNotes" as any); setEditingSlideValue((slide as any).speakerNotes || "") }}
                        className="w-full text-left text-[9px] text-muted hover:text-ink rounded-lg px-3 py-2 border border-dashed border-hairline/50 hover:border-steel/30 transition-colors truncate"
                      >
                        {(slide as any).speakerNotes ? `Notes: ${(slide as any).speakerNotes}` : "+ Add speaker notes"}
                      </button>
                    )}
                  </div>

                  {/* Footer */}
                  <div className={cn("px-5 py-1.5 flex items-center justify-between text-[8px]", ts.mutedColor, currentTheme === "hp" && "bg-[#f0f4ff]")}>
                    {showWatermark && <span>QuizFlow</span>}
                    {!isTitle && <span>{idx + 1}</span>}
                  </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
          {/* Add slide button */}
          <button
            onClick={async () => {
              const order = pres.slides?.length ?? 0
              await addCvxSlide(pres._id, { title: "New Slide", content: ["Add your content here"], layout: "titleContent", order })
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-hairline text-body-sm text-muted hover:text-ink hover:border-steel transition-colors"
          >
            <Plus size={16} /> Add Slide
          </button>
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
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} onBlur={() => convexUserId && updateSettingsCvx({ userId: convexUserId, displayName })} className="text-input" />
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
                      const token = (localStorage.getItem("access_token") || "")
                      const res = await fetch("/api/settings/check-username", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ username: val }),
                      })
                      const d = await res.json()
                      if (d.available) {
                        setUsernameError("")
                        if (convexUserId) await updateSettingsCvx({ userId: convexUserId, username: val })
                        localStorage.setItem("username", val)
                        await updateSettings({ username: val })
                        setUsernameSaved(true)
                        setTimeout(() => setUsernameSaved(false), 2500)
                      } else {
                        setUsernameError(d.error?.message || d.message || "Username is taken")
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
              <FluidDropdown
                items={languageItems}
                selectedId={language}
                onSelect={(id) => { setLanguage(id as Lang); if (convexUserId) updateSettingsCvx({ userId: convexUserId, languageCode: id }) }}
              />
            </div>

            <div className="card-feature">
              <p className="text-body-sm-medium text-ink">{t("aiCredits")}</p>
              <p className="text-[36px] font-semibold leading-[1.2] tracking-[-0.5px] text-brand-green mt-1">{user.credits}</p>
              <p className="text-caption text-muted">{t("creditsRefresh")}</p>
            </div>

            <button onClick={async () => {
              if (!confirm("Delete your account?")) return
              try {
                if (convexUserId) await deleteAccountCvx({ userId: convexUserId })
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

  if (screen === "trash") {
    const empty = trashQuizzes.length === 0 && trashCrosswords.length === 0 && trashPresentations.length === 0 && trashFolders.length === 0
    const totalCount = trashQuizzes.length + trashCrosswords.length + trashPresentations.length + trashFolders.length

    async function handleRestore(type: "quizzes" | "crosswords" | "presentations" | "folders", ids: string[]) {
      try {
        if (type === "quizzes") {
          await restoreCvxQuizzes(ids as Id<"quizzes">[])
        } else if (type === "crosswords") {
          await restoreCvxCrosswords(ids as Id<"crosswords">[])
        } else if (type === "presentations") {
          await restoreCvxPresentations(ids as Id<"presentations">[])
        } else {
          await restoreCvxFolders(ids as Id<"folders">[])
        }
      } catch {}
    }

    async function handlePermanentDelete(type: "quizzes" | "crosswords" | "presentations" | "folders", ids: string[]) {
      if (!confirm(t("deletePermanentlyConfirm").replace("{count}", String(ids.length)))) return
      try {
        if (type === "quizzes") {
          await permanentDeleteCvxQuizzes(ids as Id<"quizzes">[])
        } else if (type === "crosswords") {
          await permanentDeleteCvxCrosswords(ids as Id<"crosswords">[])
        } else if (type === "presentations") {
          await permanentDeleteCvxPresentations(ids as Id<"presentations">[])
        } else {
          await permanentDeleteCvxFolders(ids as Id<"folders">[])
        }
      } catch {}
    }

    async function handleClearTrash() {
      if (!confirm(t("clearTrashConfirm"))) return
      try {
        if (trashQuizzes.length > 0) await permanentDeleteCvxQuizzes(trashQuizzes.map(q => q.id) as Id<"quizzes">[])
        if (trashCrosswords.length > 0) await permanentDeleteCvxCrosswords(trashCrosswords.map(c => c.id) as Id<"crosswords">[])
        if (trashPresentations.length > 0) await permanentDeleteCvxPresentations(trashPresentations.map(p => p.id) as Id<"presentations">[])
        if (trashFolders.length > 0) await permanentDeleteCvxFolders(trashFolders.map(f => f.id) as Id<"folders">[])
      } catch {}
    }

    return (
      <div key="trash" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up">
        <header className="flex items-center justify-between px-6 h-14 hairline-bottom">
          <div className="flex items-center gap-3">
            <button onClick={() => go("library")} className="btn-icon"><ArrowLeft size={16} /></button>
            <Logo size={28} />
            <h2 className="text-heading-5">{t("trash")}</h2>
            {!empty && (
              <span className="text-caption text-muted">({totalCount})</span>
            )}
          </div>
          {!empty && (
            <button onClick={handleClearTrash} className="btn-primary text-sm !px-3 !py-1.5 inline-flex items-center gap-1.5 text-brand-error border border-brand-error/20 bg-brand-error/5 hover:bg-brand-error/10">
              <Trash2 size={14} /> {t("clearTrash")}
            </button>
          )}
        </header>
        <div className="px-6 py-6 space-y-4">
          {empty && (
            <div className="text-center py-16">
              <p className="text-body-md text-steel mb-1">{t("trashEmpty")}</p>
              <p className="text-caption text-muted">{t("trashEmptyHint")}</p>
            </div>
          )}

          {trashFolders.length > 0 && (
            <div>
              <p className="micro-uppercase text-steel mb-2">{t("folders")} ({trashFolders.length})</p>
              <div className="space-y-1">
                {trashFolders.map(f => (
                  <div key={f.id} className="sidebar-item">
                    <Folder size={14} className="text-steel shrink-0" />
                    <span className="flex-1 truncate text-ink">{f.name}</span>
                    <button onClick={() => handleRestore("folders", [f.id])} className="btn-icon !w-7 !h-7 text-brand-green" title={t("restore")}>
                      <RotateCcw size={13} />
                    </button>
                    <button onClick={() => handlePermanentDelete("folders", [f.id])} className="btn-icon !w-7 !h-7 text-brand-error" title={t("deletePermanently")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trashQuizzes.length > 0 && (
            <div>
              <p className="micro-uppercase text-steel mb-2">{t("quizzes")} ({trashQuizzes.length})</p>
              <div className="space-y-1">
                {trashQuizzes.map(q => (
                  <div key={q.id} className="sidebar-item">
                    <FileText size={14} className="text-steel shrink-0" />
                    <span className="flex-1 truncate text-ink">{q.title}</span>
                    <button onClick={() => handleRestore("quizzes", [q.id])} className="btn-icon !w-7 !h-7 text-brand-green" title={t("restore")}>
                      <RotateCcw size={13} />
                    </button>
                    <button onClick={() => handlePermanentDelete("quizzes", [q.id])} className="btn-icon !w-7 !h-7 text-brand-error" title={t("deletePermanently")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trashCrosswords.length > 0 && (
            <div>
              <p className="micro-uppercase text-steel mb-2">{t("crosswords")} ({trashCrosswords.length})</p>
              <div className="space-y-1">
                {trashCrosswords.map(c => (
                  <div key={c.id} className="sidebar-item">
                    <Grid3x3 size={14} className="text-amber-500 shrink-0" />
                    <span className="flex-1 truncate text-ink">{c.title}</span>
                    <button onClick={() => handleRestore("crosswords", [c.id])} className="btn-icon !w-7 !h-7 text-brand-green" title={t("restore")}>
                      <RotateCcw size={13} />
                    </button>
                    <button onClick={() => handlePermanentDelete("crosswords", [c.id])} className="btn-icon !w-7 !h-7 text-brand-error" title={t("deletePermanently")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trashPresentations.length > 0 && (
            <div>
              <p className="micro-uppercase text-steel mb-2">{t("presentationsCount")} ({trashPresentations.length})</p>
              <div className="space-y-1">
                {trashPresentations.map(p => (
                  <div key={p.id} className="sidebar-item">
                    <Presentation size={14} className="text-blue-500 shrink-0" />
                    <span className="flex-1 truncate text-ink">{p.title}</span>
                    <button onClick={() => handleRestore("presentations", [p.id])} className="btn-icon !w-7 !h-7 text-brand-green" title={t("restore")}>
                      <RotateCcw size={13} />
                    </button>
                    <button onClick={() => handlePermanentDelete("presentations", [p.id])} className="btn-icon !w-7 !h-7 text-brand-error" title={t("deletePermanently")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (screen === "admin") {
    return (
      <div key="admin" className="min-h-screen bg-canvas max-w-2xl mx-auto border-x border-hairline animate-slide-up" style={{ paddingBottom: "100px" }}>
        <header className="flex items-center gap-3 px-6 h-14 hairline-bottom">
          <button onClick={() => go(user ? "library" : "login")} className="btn-icon"><ArrowLeft size={16} /></button>
          <Logo size={28} />
          <h2 className="text-heading-5">Admin Panel</h2>
        </header>
        <div className="px-6 py-6 space-y-8">

          <div>
            <p className="micro-uppercase text-steel mb-3">Configuration</p>
            <div className="card-base p-4 space-y-3">
              <p className="text-caption text-steel">Export your local env config as JSON to paste into Railway, or import JSON from another deployment.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/config?export=true&password=${adminPassword}`)
                    const d = await res.json()
                    if (d.data) {
                      await navigator.clipboard.writeText(JSON.stringify(d.data, null, 2))
                      alert("Config copied to clipboard as JSON!")
                    }
                  } catch { alert("Export failed") }
                }} className="btn-primary text-sm !py-1.5">Export Config</button>
                <button onClick={() => setShowImportModal(true)} className="btn-ghost text-sm !py-1.5">Import Config</button>
              </div>
            </div>
          </div>

          {showImportModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
              <div className="card-base max-w-md w-full p-6 animate-scale-in">
                <p className="text-body-md-medium text-ink mb-2">Import Configuration</p>
                <p className="text-body-sm text-steel mb-4">Paste the JSON config exported from your local app.</p>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  className="text-input font-mono text-sm w-full mb-4"
                  rows={10}
                  placeholder='{"DATABASE_URL": "...", "JWT_SECRET": "...", ...}'
                />
                <div className="flex gap-2.5">
                  <button onClick={() => { setShowImportModal(false); setImportJson("") }} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={async () => {
                    try {
                      const parsed = JSON.parse(importJson)
                      const res = await fetch("/api/admin/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: adminPassword, ...parsed }),
                      })
                      if (res.ok) {
                        alert("Config imported! Restart the app for changes to take effect.")
                        setShowImportModal(false)
                        setImportJson("")
                        fetch("/api/admin/config").then(r => r.json()).then(d => { if (d.data) setCfg(d.data) }).catch(() => {})
                      } else {
                        const err = await res.json()
                        alert("Import failed: " + (err.error?.message || "Unknown error"))
                      }
                    } catch { alert("Invalid JSON") }
                  }} className="btn-primary flex-1">Import</button>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="micro-uppercase text-steel mb-3">OpenRouter API Keys</p>
            <div className="card-base p-4 space-y-3">
              {keysList.length === 0 && !testingKeys && (
                <p className="text-caption text-steel">No API keys configured.</p>
              )}
              {keysList.map((key, i) => {
                const r = keyResults[key] || {}
                const masked = key.length > 12 ? key.slice(0, 8) + "..." + key.slice(-4) : key
                const isExpanded = expandedKey === key
                const isTestingThis = testingSingleKey === key
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 text-body-sm py-1">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", r.canGenerate ? "bg-brand-green" : r.valid ? "bg-yellow-500" : "bg-brand-error")} title={r.canGenerate ? "Working" : r.valid ? "Valid but no credits" : "Invalid"} />
                      <span className="font-mono text-steel flex-1 truncate" title={key}>{masked}</span>
                      {typeof r.usage_monthly === "number" && (
                        <span className="text-caption text-steel" title="Monthly usage">${r.usage_monthly.toFixed(4)}</span>
                      )}
                      {r.is_free_tier && <span className="text-caption text-yellow-500 font-medium">FREE</span>}
                      <button
                        onClick={() => testSingleKey(key)}
                        disabled={isTestingThis}
                        className="btn-ghost text-xs !py-0.5 !px-2 shrink-0"
                        title="Test this key"
                      >
                        {isTestingThis ? "..." : "Test"}
                      </button>
                      <button onClick={() => setExpandedKey(isExpanded ? null : key)} className="btn-icon !w-5 !h-5 text-steel hover:bg-steel/10 shrink-0" title="Details">
                        {isExpanded ? "▼" : "▶"}
                      </button>
                      <button onClick={() => setKeysList(p => p.filter((_, j) => j !== i))} className="btn-icon !w-5 !h-5 text-brand-error hover:bg-brand-error/10 shrink-0" title="Remove key">✕</button>
                    </div>
                    {isTestingThis && (
                      <div className="ml-4 text-caption text-steel flex items-center gap-1 py-1">
                        <Loader size="sm" variant="spin" /> Testing...
                      </div>
                    )}
                    {!isTestingThis && r.aiResponse && (
                      <div className="ml-4 text-caption text-brand-green py-1">"{r.aiResponse}"</div>
                    )}
                    {!isTestingThis && r.generateError && !r.canGenerate && expandedKey !== key && (
                      <div className="ml-4 text-caption text-brand-error py-1 truncate">{r.generateError}</div>
                    )}
                    {isExpanded && (
                      <div className="ml-4 mt-1 mb-2 p-3 bg-ink/5 rounded-lg text-caption text-steel space-y-1">
                        <div className="flex justify-between">
                          <span>Auth valid:</span>
                          <span className={r.valid ? "text-brand-green" : "text-brand-error"}>{r.valid ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Can generate:</span>
                          <span className={r.canGenerate ? "text-brand-green" : "text-brand-error"}>{r.canGenerate ? "Yes" : "No"}</span>
                        </div>
                        {!r.canGenerate && r.generateError && (
                          <div className="flex justify-between">
                            <span>Error:</span>
                            <span className="text-brand-error max-w-[60%] text-right truncate">{r.generateError}</span>
                          </div>
                        )}
                        {r.canGenerate && r.aiResponse && (
                          <div className="flex justify-between">
                            <span>AI response:</span>
                            <span className="max-w-[60%] text-right">"{r.aiResponse}"</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Free tier:</span>
                          <span>{r.is_free_tier ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Monthly usage:</span>
                          <span>${(r.usage_monthly ?? 0).toFixed(4)}</span>
                        </div>
                        {r.limit !== null && r.limit !== undefined && (
                          <div className="flex justify-between">
                            <span>Credit limit:</span>
                            <span>${r.limit}</span>
                          </div>
                        )}
                        {r.limit_remaining !== null && r.limit_remaining !== undefined && (
                          <div className="flex justify-between">
                            <span>Remaining:</span>
                            <span>${r.limit_remaining}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {testingKeys && <div className="flex items-center gap-2 text-caption text-steel"><Loader size="md" variant="spin" /> Testing all keys…</div>}
              {keysList.length > 0 && !testingKeys && (
                <div className="flex items-center gap-3 text-caption text-steel pt-1 border-t border-ink/10">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-green" /> Working</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> No credits</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-error" /> Invalid</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newKeyInput}
                  onChange={e => setNewKeyInput(e.target.value)}
                  className="text-input font-mono text-sm flex-1"
                  placeholder="sk-or-v1-..."
                  onKeyDown={e => {
                    if (e.key !== "Enter" || !newKeyInput.trim()) return
                    setKeysList(p => [...p, newKeyInput.trim()])
                    setNewKeyInput("")
                  }}
                />
                <button onClick={() => {
                  if (!newKeyInput.trim()) return
                  setKeysList(p => [...p, newKeyInput.trim()])
                  setNewKeyInput("")
                }} className="btn-primary text-sm !py-1.5 !px-3">Add</button>
              </div>
              <details className="group">
                <summary className="text-caption text-steel cursor-pointer select-none group-open:text-ink">Preview JSON backup</summary>
                <textarea readOnly value={JSON.stringify({ backupDate: new Date().toISOString(), keys: keysList.map(k => keyResults[k] || { key: k, valid: false }) }, null, 2)} className="text-input font-mono text-xs w-full mt-2" rows={6} onClick={e => { (e.target as HTMLTextAreaElement).select(); navigator.clipboard.writeText((e.target as HTMLTextAreaElement).value) }} />
              </details>
              <div className="flex gap-2">
                <button onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/config", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password: adminPassword, OPENROUTER_API_KEYS: keysList.join(",") }),
                    })
                    if (res.ok) {
                      alert("API keys saved!")
                      fetch("/api/admin/config").then(r => r.json()).then(d => { if (d.data) setCfg(d.data) }).catch(() => {})
                    } else {
                      const err = await res.json()
                      alert("Failed: " + (err.error?.message || "Unknown"))
                    }
                  } catch { alert("Save failed") }
                }} className="btn-primary text-sm !py-1.5">Save API Keys</button>
                <button onClick={async () => {
                  const json = JSON.stringify({ backupDate: new Date().toISOString(), keys: keysList.map(k => keyResults[k] || { key: k, valid: false }) }, null, 2)
                  await navigator.clipboard.writeText(json)
                  alert("Keys JSON copied!")
                }} className="btn-ghost text-sm !py-1.5">Copy JSON</button>
                <button
                  onClick={async () => {
                    setAiTestResult({ status: "testing", message: "", response: "" })
                    try {
                      const key = keysList[0]
                      if (!key) { setAiTestResult({ status: "error", message: "No keys configured", response: "" }); return }
                      const res = await fetch("/api/admin/test-key", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: adminPassword, key }),
                      })
                      const d = await res.json()
                      const r = d.data || {}
                      if (r.canGenerate) {
                        setAiTestResult({ status: "success", message: `AI working (${r.label || key.slice(0, 12) + "..."})`, response: r.aiResponse || "" })
                      } else {
                        setAiTestResult({ status: "error", message: r.generateError || "Key cannot generate. No credits?", response: "" })
                      }
                    } catch {
                      setAiTestResult({ status: "error", message: "Test failed", response: "" })
                    }
                  }}
                  disabled={aiTestResult.status === "testing" || keysList.length === 0}
                  className="btn-ghost text-sm !py-1.5"
                >
                  {aiTestResult.status === "testing" ? "Testing..." : "Test AI"}
                </button>
              </div>
              {aiTestResult.status !== "idle" && aiTestResult.status !== "testing" && (
                <div className={cn("text-caption p-2 rounded-lg", aiTestResult.status === "success" ? "bg-brand-green/10 text-brand-green" : "bg-brand-error/10 text-brand-error")}>
                  <div>{aiTestResult.message}</div>
                  {aiTestResult.response && (
                    <div className="mt-1 font-mono text-xs opacity-80">"{aiTestResult.response}"</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">Telegram Bot Token</p>
            <div className="card-base p-4 space-y-3">
              <p className="text-caption text-steel">Update the Telegram bot token.</p>
              <input
                value={botTokenInput}
                onChange={e => setBotTokenInput(e.target.value)}
                className="text-input font-mono text-sm w-full"
                placeholder="123456:ABCdef..."
              />
              <button onClick={async () => {
                try {
                  const res = await fetch("/api/admin/config", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: adminPassword, TELEGRAM_BOT_TOKEN: botTokenInput }),
                  })
                  if (res.ok) {
                    alert("Bot token saved! Restart the bot for changes to take effect.")
                    fetch("/api/admin/config").then(r => r.json()).then(d => { if (d.data) setCfg(d.data) }).catch(() => {})
                  } else {
                    const err = await res.json()
                    alert("Failed: " + (err.error?.message || "Unknown"))
                  }
                } catch { alert("Save failed") }
              }} className="btn-primary text-sm !py-1.5">Save Token</button>
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
                    try {
                      const res = await fetch("/api/admin/bot", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: adminPassword, action: "start" }),
                      })
                      const d = await res.json()
                      if (d.error) { alert(d.error.message); setBotStatus("stopped"); return }
                      setBotStatus(d.data?.status === "started" ? "running" : "stopped")
                    } catch { setBotStatus("stopped") }
                  }} className="btn-primary flex-1 text-sm !py-1.5">Start Bot</button>
                ) : (
                  <button onClick={async () => {
                    try {
                      const res = await fetch("/api/admin/bot", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ password: adminPassword, action: "stop" }),
                      })
                      const d = await res.json()
                      if (d.error) { alert(d.error.message); return }
                      setBotStatus(d.data?.status === "stopped" ? "stopped" : "running")
                    } catch {}
                  }} className="btn-ghost border border-btn-border flex-1 text-sm !py-1.5">Stop Bot</button>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="micro-uppercase text-steel mb-3">Users</p>
            <div className="card-base p-4 space-y-3">
              <div className="flex gap-2">
                <FluidDropdown
                  items={[
                    { id: "", label: "Select a user…", icon: User, color: "#A06CD5" },
                    ...adminUsers.map(u => ({
                      id: u.id,
                      label: `${u.displayName}${u.telegramUsername ? ` (@${u.telegramUsername})` : ""} — ${u.tokens} tokens`,
                      icon: User,
                      color: u.tokens > 0 ? "#4ECDC4" : "#FF6B6B",
                    })),
                  ]}
                  selectedId={selectedUserId}
                  onSelect={setSelectedUserId}
                />
              </div>
              {selectedUserId && (() => {
                const selected = adminUsers.find(u => u.id === selectedUserId)
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
                        if (amt === 0 || isNaN(amt)) return
                        setCreditMsg("Updating...")
                        try {
                          const res = await fetch("/api/admin/users", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ password: adminPassword, userId: selectedUserId, credits: amt }),
                          })
                          if (res.ok) {
                            setAdminUsers(prev => prev.map(u => u.id === selectedUserId ? { ...u, credits: Math.max(0, u.credits + amt), tokens: Math.max(0, u.tokens + amt) } : u))
                            const sel = adminUsers.find(u => u.id === selectedUserId)
                            if (sel?.clerkId) {
                              adjustCreditsByClerkIdCvx({ clerkId: sel.clerkId, amount: amt }).catch(() => {})
                              if (user?.clerkId === sel.clerkId) {
                                setUser(prev => prev ? { ...prev, credits: Math.max(0, prev.credits + amt) } : null)
                              }
                            }
                            setCreditMsg(amt > 0 ? `Added ${amt} credits!` : `Subtracted ${Math.abs(amt)} credits`)
                          } else {
                            setCreditMsg("Failed")
                          }
                          setCreditAmount("")
                          setTimeout(() => setCreditMsg(""), 3000)
                        } catch { setCreditMsg("Failed") }
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
                    body: JSON.stringify({ password: adminPassword }),
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

const cwDifficultyOptions = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
]

const cwLangOptions = [
  { id: "en", label: "English" },
  { id: "uz", label: "Uzbek (O'zbek)" },
  { id: "ru", label: "Russian (Русский)" },
]

function AddQuizModal({ open, folders, onAdd, onAddFolder, onClose, t, generating, progress, clarificationQuestion, onClarify }: {
  open: boolean; folders: Folder[]; onAdd: (title: string, description: string, folderId: string | null, questionCount?: number, difficulty?: string, language?: string) => void
  onAddFolder: (name: string) => void | Promise<string>; onClose: () => void; t: (key: string) => string; generating?: boolean; progress?: number
  clarificationQuestion?: string | null; onClarify?: (answer: string) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questionCount, setQuestionCount] = useState(5)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [quizDifficulty, setQuizDifficulty] = useState("medium")
  const [quizLanguage, setQuizLanguage] = useState("en")

  const DIFFICULTY_OPTIONS = [
    { id: "easy", label: "Easy" },
    { id: "medium", label: "Medium" },
    { id: "hard", label: "Hard" },
  ]

  const LANG_OPTIONS = [
    { id: "en", label: "English" },
    { id: "uz", label: "Uzbek (O'zbek)" },
    { id: "ru", label: "Russian (Русский)" },
  ]
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [clarifyAnswer, setClarifyAnswer] = useState("")

  if (!open) return null

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
              <FluidDropdown
                items={[
                  { id: "", label: t("noFolder"), icon: Folder, color: "#A06CD5" },
                  ...folders.map(f => ({ id: f.id, label: f.name, icon: Folder, color: "#A06CD5" })),
                  { id: "__new__", label: t("newFolderOption"), icon: Plus, color: "#4ECDC4" },
                ]}
                selectedId={folderId ?? ""}
                onSelect={(val) => {
                  if (val === "__new__") { setShowNewFolder(true); return }
                  setFolderId(val || null)
                }}
              />
            )}
          </div>
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">Difficulty</label>
            <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
              {DIFFICULTY_OPTIONS.map(d => (
                <button key={d.id} type="button" onClick={() => setQuizDifficulty(d.id)} className={cn("flex-1 px-3 py-1.5 text-body-sm rounded-md transition-all duration-150", quizDifficulty === d.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">Language</label>
            <div className="flex gap-1 p-0.5 bg-hairline rounded-lg">
              {LANG_OPTIONS.map(l => (
                <button key={l.id} type="button" onClick={() => setQuizLanguage(l.id)} className={cn("flex-1 px-3 py-1.5 text-body-sm rounded-md transition-all duration-150", quizLanguage === l.id ? "bg-surface text-ink font-medium shadow-sm" : "text-muted hover:text-ink")}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={onClose} disabled={generating} className={cn("btn-secondary flex-1", generating && "opacity-40 cursor-not-allowed")}>{t("cancel")}</button>
          <button onClick={() => { if (title.trim()) onAdd(title.trim(), description.trim(), folderId, questionCount, quizDifficulty, quizLanguage) }} disabled={!title.trim() || generating} className="btn-primary flex-1">
            {generating ? <span className="flex items-center gap-1.5"><Loader size="md" variant="spin" /> Generating…</span> : t("create")}
          </button>
        </div>
        {generating && (
          <div className="mt-3">
            <div className="flex justify-between text-caption text-steel mb-1">
              <span>{(progress ?? 0) < 50 ? "AI is thinking..." : (progress ?? 0) < 90 ? "Saving..." : "Done!"}</span>
              <span>{progress ?? 0}%</span>
            </div>
            <div className="w-full bg-ink/10 rounded-full h-1.5">
              <div className="bg-brand-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress ?? 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PasteQuizModal({ open, onClose, folders, onAddFolder, onPaste }: {
  open: boolean; onClose: () => void; folders: Folder[]; onAddFolder: (name: string) => void | Promise<string>
  onPaste: (title: string, description: string, questions: Question[], folderId: string | null) => void
}) {
  const [raw, setRaw] = useState("")
  const [folderId, setFolderId] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const id = await onAddFolder(newFolderName.trim())
    if (id) setFolderId(id)
    setShowNewFolder(false)
    setNewFolderName("")
  }

  function handleSubmit() {
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") { alert("Invalid JSON format"); return }
      const title = sanitize(parsed.title ?? "")
      if (!title) { alert("Quiz title is required"); return }
      const description = sanitize(parsed.description ?? "")
      const rawQuestions: any[] = parsed.questions ?? []
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
      setRaw("")
      onPaste(title, description, questions, folderId)
    } catch {
      alert("Invalid JSON — check the format and try again")
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="card-base max-w-lg w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-1">
          <p className="text-body-md-medium text-ink">Paste Quiz Content</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-hairline transition-all duration-150 -mr-1">
            <X size={16} />
          </button>
        </div>
        <p className="text-body-sm text-steel mb-4">Paste JSON from your AI tool</p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">JSON Content</label>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder='{"title":"My Quiz","questions":[{"text":"...","options":["A","B","C","D"],"correctIndex":0}]}'
              className="text-input !h-48 !resize-y font-mono text-caption"
            />
          </div>
          <div>
            <label className="text-body-sm font-medium text-ink block mb-1.5">Folder</label>
            {showNewFolder ? (
              <div className="flex gap-2">
                <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name" className="text-input flex-1" autoFocus onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false) }} />
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="btn-primary !px-3 !py-1.5 text-sm">Add</button>
              </div>
            ) : (
              <FluidDropdown
                items={[
                  { id: "", label: "No folder", icon: Folder, color: "#A06CD5" },
                  ...folders.map(f => ({ id: f.id, label: f.name, icon: Folder, color: "#A06CD5" })),
                  { id: "__new__", label: "New folder", icon: Plus, color: "#4ECDC4" },
                ]}
                selectedId={folderId ?? ""}
                onSelect={(val) => {
                  if (val === "__new__") { setShowNewFolder(true); return }
                  setFolderId(val || null)
                }}
              />
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={!raw.trim()} className="btn-primary flex-1">Create Quiz</button>
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
                  <FluidDropdown
                    items={[
                      { id: "", label: t("noFolder"), icon: Folder, color: "#A06CD5" },
                      ...folders.map(f => ({ id: f.id, label: f.name, icon: Folder, color: "#A06CD5" })),
                      { id: "__new__", label: t("newFolderOption"), icon: Plus, color: "#4ECDC4" },
                    ]}
                    selectedId={folderId ?? ""}
                    onSelect={(val) => {
                      if (val === "__new__") { setShowNewFolder(true); return }
                      onChangeFolder(val || null)
                    }}
                  />
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

function TeachersModeModal({ open, onClose, stats, t }: {
  open: boolean
  onClose: () => void
  stats: any
  t: (key: string) => string
}) {
  if (!open) return null

  const items = Array.isArray(stats) ? stats : []

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 px-4 pt-12 pb-8 overflow-y-auto animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="card-base w-full max-w-lg p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-body-md-medium text-ink">Teachers Mode — Analytics</p>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-body-sm text-steel mb-3">No shared content yet</p>
            <p className="text-caption text-muted">Share this quiz or crossword to start collecting results.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item: any) => {
              const attemptList = item.attempts ?? []
              return (
                <div key={item.linkId} className="rounded-lg border border-hairline p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-body-sm-medium text-ink">{item.contentTitle}</p>
                      <p className="text-caption text-steel">{item.itemType} · {item.attemptCount} attempt{item.attemptCount !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-heading-5 text-brand-green">{item.completedCount}</p>
                      <p className="text-caption text-steel">completed</p>
                    </div>
                  </div>
                  {item.attemptCount > 0 && (
                    <div className="flex gap-4 text-center">
                      <div className="flex-1 rounded-lg bg-surface p-2">
                        <p className="text-body-sm-medium text-ink">{item.attemptCount}</p>
                        <p className="text-caption text-steel">Total</p>
                      </div>
                      <div className="flex-1 rounded-lg bg-surface p-2">
                        <p className="text-body-sm-medium text-ink">{item.completedCount}</p>
                        <p className="text-caption text-steel">Completed</p>
                      </div>
                      <div className="flex-1 rounded-lg bg-surface p-2">
                        <p className="text-body-sm-medium text-ink">{item.avgPercentage}%</p>
                        <p className="text-caption text-steel">Avg Score</p>
                      </div>
                    </div>
                  )}
                  {attemptList.length > 0 && (
                    <div>
                      <p className="text-caption font-medium text-steel mb-1.5">Attempts</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {attemptList.map((a: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-caption py-1 border-b border-hairline-soft last:border-0">
                            <span className="text-steel">{a.participantName ?? `Attempt #${i + 1}`}</span>
                            <span className={a.completed ? "text-brand-green" : "text-steel"}>
                              {a.completed ? `${a.score ?? "?"}/${a.total ?? "?"}${a.score != null && a.total != null && a.total > 0 ? ` (${Math.round((a.score / a.total) * 100)}%)` : ""}` : "Incomplete"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn-secondary">{t("close")}</button>
        </div>
      </div>
    </div>
  )
}

function ShareModal({ open, quizId, onClose, t, onGenerateLink }: { open: boolean; quizId?: string; onClose: () => void; t: (key: string) => string; onGenerateLink?: () => Promise<string> }) {
  const [link, setLink] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      if (onGenerateLink) {
        onGenerateLink().then(url => {
          setLink(url)
          navigator.clipboard?.writeText(url).catch(() => {})
          setCopied(true)
        }).catch(() => {
          setLink(quizId ? `${window.location.origin}/shared/${quizId}` : "")
        })
      } else {
        setLink(quizId ? `${window.location.origin}/shared/${quizId}` : "")
      }
    } else {
      setCopied(false)
      setLink("")
    }
  }, [open, quizId, onGenerateLink])

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

function FlagQuestionModal({ onClose, onFlag, alreadyFlagged, t }: {
  onClose: () => void
  onFlag: (reason: string) => void
  alreadyFlagged: boolean
  t: (key: string) => string
}) {
  const reasons = [
    { key: "incorrect_answer", label: "Incorrect answer" },
    { key: "typo", label: "Typo or spelling error" },
    { key: "formatting", label: "Formatting issue" },
    { key: "other", label: "Other" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="card-base p-6 w-full max-w-sm mx-4 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-heading-5 flex items-center gap-2"><Flag size={16} className="text-brand-error" /> Flag Question</h3>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>
        {alreadyFlagged ? (
          <div className="text-center py-4">
            <Check size={32} className="text-brand-green mx-auto mb-2" />
            <p className="text-body-sm text-steel">This question has been flagged. Thank you for your feedback.</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">{t("close")}</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-body-sm text-steel mb-3">Why are you flagging this question?</p>
            {reasons.map(r => (
              <button
                key={r.key}
                onClick={() => onFlag(r.key)}
                className="w-full text-left px-4 py-3 rounded-lg border border-hairline text-body-sm hover:bg-surface hover:border-steel transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

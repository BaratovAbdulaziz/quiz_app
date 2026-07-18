import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useEffect, useState } from "react"
import { useUser, useAuth, useClerk } from "@clerk/nextjs"

export interface ConvexUser {
  _id: Id<"users">
  clerkId: string
  telegramId?: number
  telegramUsername?: string
  email?: string
  authProvider: string
  username?: string
  displayName: string
  photoUrl?: string
  languageCode: string
  credits: number
  creditsRefreshAt: number
  isTestUser: boolean
  deletedAt?: number
  _creationTime: number
}

export interface ConvexQuiz {
  _id: Id<"quizzes">
  userId: Id<"users">
  folderId?: Id<"folders">
  title: string
  description?: string
  source: string
  sourceFileId?: Id<"files">
  questionCount: number
  deletedAt?: number
  _creationTime: number
  questions?: ConvexQuestion[]
}

export interface ConvexQuestion {
  _id: Id<"questions">
  quizId: Id<"quizzes">
  text: string
  options: string[]
  correctIndex: number
  explanation?: string
  order: number
  _creationTime: number
}

export interface ConvexFolder {
  _id: Id<"folders">
  userId: Id<"users">
  parentId?: Id<"folders">
  name: string
  deletedAt?: number
  _creationTime: number
}

interface ConvexSession {
  _id: Id<"quizSessions">
  quizId: Id<"quizzes">
  userId: Id<"users">
  mode: string
  status: string
  score?: number
  total?: number
  skippedCount: number
  timeSeconds?: number
  completedAt?: number
  _creationTime: number
}

// Hook that provides the current user (syncs Clerk to Convex)
export function useCurrentUser() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const syncUser = useMutation(api.users.syncUser)
  const [convexUserId, setConvexUserId] = useState<Id<"users"> | null>(null)
  const [syncing, setSyncing] = useState(true)

  const convexUser = useQuery(
    api.users.getUserById,
    convexUserId ? { userId: convexUserId } : "skip",
  )

  useEffect(() => {
    if (!clerkLoaded) return
    if (!clerkUser) {
      setSyncing(false)
      return
    }
    (async () => {
      let pgCredits: number | undefined
      let pgCreditsRefreshAt: number | undefined
      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          const d = await res.json()
          pgCredits = d.data?.credits
          pgCreditsRefreshAt = d.data?.creditsRefreshAt ? new Date(d.data.creditsRefreshAt).getTime() : undefined
        }
      } catch {}
      try {
        const result = await syncUser({
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress,
          displayName: clerkUser.fullName || clerkUser.username || "User",
          imageUrl: clerkUser.imageUrl,
          credits: pgCredits,
          creditsRefreshAt: pgCreditsRefreshAt,
        })
        setConvexUserId(result.userId as Id<"users">)
      } catch {}
      setSyncing(false)
    })()
  }, [clerkLoaded, clerkUser, syncUser])

  return {
    convexUser,
    convexUserId,
    isLoading: !clerkLoaded || syncing,
    isAuthenticated: !!convexUser || !!convexUserId,
  }
}

export function useFolders(userId?: Id<"users">) {
  const folders = useQuery(api.folders.list, userId ? { userId } : "skip")
  const createFolder = useMutation(api.folders.create)
  const renameFolder = useMutation(api.folders.rename)
  const deleteFolder = useMutation(api.folders.remove)
  const batchDelete = useMutation(api.folders.batchRemove)
  const restore = useMutation(api.folders.restore)
  const permanentDelete = useMutation(api.folders.permanentDelete)

  const trashFolders = useQuery(api.folders.listTrash, userId ? { userId } : "skip")

  return {
    folders,
    trashFolders,
    createFolder: async (name: string) => {
      if (!userId) throw new Error("Not authenticated")
      return await createFolder({ userId, name })
    },
    renameFolder: async (folderId: Id<"folders">, name: string) => {
      await renameFolder({ folderId, name })
    },
    deleteFolder: async (folderId: Id<"folders">) => {
      await deleteFolder({ folderId })
    },
    batchDeleteFolders: async (ids: Id<"folders">[]) => {
      await batchDelete({ folderIds: ids })
    },
    restoreFolders: async (ids: Id<"folders">[]) => {
      await restore({ folderIds: ids })
    },
    permanentDeleteFolders: async (ids: Id<"folders">[]) => {
      await permanentDelete({ folderIds: ids })
    },
  }
}

export function useQuizzes(userId?: Id<"users">) {
  const quizzes = useQuery(api.quizzes.list, userId ? { userId } : "skip")
  const trashQuizzes = useQuery(api.quizzes.listTrash, userId ? { userId } : "skip")
  const createMutation = useMutation(api.quizzes.create)
  const updateMutation = useMutation(api.quizzes.update)
  const removeMutation = useMutation(api.quizzes.remove)
  const batchRemoveMutation = useMutation(api.quizzes.batchRemove)
  const batchMoveMutation = useMutation(api.quizzes.batchMove)
  const restoreMutation = useMutation(api.quizzes.restore)
  const permanentDeleteMutation = useMutation(api.quizzes.permanentDelete)

  return {
    quizzes,
    trashQuizzes,
    getQuiz: useQuery, // caller uses this directly with api.quizzes.get
    createQuiz: async (data: {
      title: string
      description?: string
      folderId?: Id<"folders">
      source: string
      questionCount: number
      questions: Array<{
        text: string
        options: string[]
        correctIndex: number
        explanation?: string
        order: number
      }>
    }) => {
      if (!userId) throw new Error("Not authenticated")
      return await createMutation({ userId, ...data })
    },
    updateQuiz: async (quizId: Id<"quizzes">, data: { title?: string; folderId?: Id<"folders"> | null; description?: string }) => {
      await updateMutation({ quizId, ...data, folderId: data.folderId ?? undefined })
    },
    deleteQuiz: async (quizId: Id<"quizzes">) => {
      await removeMutation({ quizId })
    },
    batchDeleteQuizzes: async (ids: Id<"quizzes">[]) => {
      await batchRemoveMutation({ quizIds: ids })
    },
    batchMoveQuizzes: async (ids: Id<"quizzes">[], folderId: Id<"folders"> | null) => {
      await batchMoveMutation({ quizIds: ids, folderId: folderId ?? undefined })
    },
    restoreQuizzes: async (ids: Id<"quizzes">[]) => {
      await restoreMutation({ quizIds: ids })
    },
    permanentDeleteQuizzes: async (ids: Id<"quizzes">[]) => {
      await permanentDeleteMutation({ quizIds: ids })
    },
  }
}

export function useSessions(userId?: Id<"users">) {
  const startSession = useMutation(api.sessions.start)
  const submitAnswer = useMutation(api.sessions.submitAnswer)
  const skipQuestion = useMutation(api.sessions.skipQuestion)
  const completeSession = useMutation(api.sessions.complete)

  return {
    startSession: async (quizId: Id<"quizzes">, mode: "practice" | "exam") => {
      if (!userId) throw new Error("Not authenticated")
      return await startSession({ quizId, userId, mode })
    },
    submitAnswer: async (sessionId: Id<"quizSessions">, questionId: Id<"questions">, selectedIndex: number) => {
      await submitAnswer({ sessionId, questionId, selectedIndex })
    },
    skipQuestion: async (sessionId: Id<"quizSessions">, questionId: Id<"questions">) => {
      await skipQuestion({ sessionId, questionId })
    },
    completeSession: async (sessionId: Id<"quizSessions">, timeSeconds?: number) => {
      return await completeSession({ sessionId, timeSeconds })
    },
  }
}

export function useShare() {
  const generate = useMutation(api.share.generateLink)
  const generateCrossword = useMutation(api.share.generateCrosswordLink)
  const importMutation = useMutation(api.share.importQuiz)
  const recordAttemptMutation = useMutation(api.sharedAttempts.record)

  return {
    generateShareLink: async (quizId: Id<"quizzes">, userId: Id<"users">) => {
      return await generate({ quizId, userId })
    },
    generateCrosswordShareLink: async (crosswordId: Id<"crosswords">, userId: Id<"users">) => {
      return await generateCrossword({ crosswordId, userId })
    },
    importQuiz: async (token: string, userId: Id<"users">) => {
      return await importMutation({ token, userId })
    },
    recordAttempt: async (data: {
      shareLinkId: Id<"shareLinks">
      participantName?: string
      score?: number
      total?: number
      completed: boolean
      timeSeconds?: number
      data?: any
    }) => {
      return await recordAttemptMutation(data)
    },
  }
}

export function useReports() {
  const createReport = useMutation(api.reports.create)

  return {
    reportQuestion: async (reporterId: Id<"users">, ownerId: Id<"users">, questionId: Id<"questions">, reason: string, comment?: string) => {
      return await createReport({ reporterId, ownerId, questionId, reason, comment })
    },
  }
}

export function useCrosswords(userId?: Id<"users">) {
  const crosswords = useQuery(api.crosswords.list, userId ? { userId } : "skip")
  const trashCrosswords = useQuery(api.crosswords.listTrash, userId ? { userId } : "skip")
  const createMutation = useMutation(api.crosswords.create)
  const updateMutation = useMutation(api.crosswords.update)
  const removeMutation = useMutation(api.crosswords.remove)
  const batchRemoveMutation = useMutation(api.crosswords.batchRemove)
  const batchMoveMutation = useMutation(api.crosswords.batchMove)
  const restoreMutation = useMutation(api.crosswords.restore)
  const permanentDeleteMutation = useMutation(api.crosswords.permanentDelete)

  return {
    crosswords,
    trashCrosswords,
    createCrossword: async (data: {
      title: string
      description?: string
      folderId?: Id<"folders">
      source: string
      difficulty?: string
      language?: string
      gridWidth?: number
      gridHeight?: number
      clues: Array<{
        word: string
        clue: string
        row?: number
        col?: number
        direction: string
        number: number
        order: number
      }>
    }) => {
      if (!userId) throw new Error("Not authenticated")
      return await createMutation({ userId, ...data })
    },
    updateCrossword: async (crosswordId: Id<"crosswords">, data: { title?: string; folderId?: Id<"folders"> | null; description?: string }) => {
      await updateMutation({ crosswordId, ...data, folderId: data.folderId ?? undefined })
    },
    deleteCrossword: async (crosswordId: Id<"crosswords">) => {
      await removeMutation({ crosswordId })
    },
    batchDeleteCrosswords: async (ids: Id<"crosswords">[]) => {
      await batchRemoveMutation({ crosswordIds: ids })
    },
    batchMoveCrosswords: async (ids: Id<"crosswords">[], folderId: Id<"folders"> | null) => {
      await batchMoveMutation({ crosswordIds: ids, folderId: folderId ?? undefined })
    },
    restoreCrosswords: async (ids: Id<"crosswords">[]) => {
      await restoreMutation({ crosswordIds: ids })
    },
    permanentDeleteCrosswords: async (ids: Id<"crosswords">[]) => {
      await permanentDeleteMutation({ crosswordIds: ids })
    },
  }
}

export function usePresentations(userId?: Id<"users">) {
  const presentations = useQuery(api.presentations.list, userId ? { userId } : "skip")
  const trashPresentations = useQuery(api.presentations.listTrash, userId ? { userId } : "skip")
  const createMutation = useMutation(api.presentations.create)
  const updateMutation = useMutation(api.presentations.update)
  const updateSlideImageMutation = useMutation(api.presentations.updateSlideImage)
  const updateSlideMutation = useMutation(api.presentations.updateSlide)
  const reorderSlidesMutation = useMutation(api.presentations.reorderSlides)
  const addSlideMutation = useMutation(api.presentations.addSlide)
  const deleteSlideMutation = useMutation(api.presentations.deleteSlide)
  const removeMutation = useMutation(api.presentations.remove)
  const batchRemoveMutation = useMutation(api.presentations.batchRemove)
  const batchMoveMutation = useMutation(api.presentations.batchMove)
  const restoreMutation = useMutation(api.presentations.restore)
  const permanentDeleteMutation = useMutation(api.presentations.permanentDelete)

  return {
    presentations,
    trashPresentations,
    createPresentation: async (data: {
      title: string
      description?: string
      folderId?: Id<"folders">
      source: string
      language?: string
      theme?: string
      size?: string
      density?: string
      style?: string
      audience?: string
      slideCount?: number
      slides: Array<{
        title: string
        content: string[]
        layout: string
        order: number
        speakerNotes?: string
      }>
    }) => {
      if (!userId) throw new Error("Not authenticated")
      return await createMutation({ userId, ...data })
    },
    updatePresentation: async (presentationId: Id<"presentations">, data: { title?: string; folderId?: Id<"folders"> | null; description?: string; theme?: string; size?: string; showWatermark?: boolean; style?: string; audience?: string; slideCount?: number }) => {
      await updateMutation({ presentationId, ...data, folderId: data.folderId ?? undefined })
    },
    updateSlideImage: async (slideId: Id<"presentationSlides">, imageUrl?: string) => {
      await updateSlideImageMutation({ slideId, imageUrl })
    },
    updateSlide: async (slideId: Id<"presentationSlides">, data: { title?: string; content?: string[]; layout?: string; fontSize?: string; speakerNotes?: string }) => {
      await updateSlideMutation({ slideId, ...data })
    },
    reorderSlides: async (slideIds: Id<"presentationSlides">[]) => {
      await reorderSlidesMutation({ slideIds })
    },
    addSlide: async (presentationId: Id<"presentations">, data: { title: string; content: string[]; layout: string; order: number; speakerNotes?: string }) => {
      return await addSlideMutation({ presentationId, ...data })
    },
    deleteSlide: async (slideId: Id<"presentationSlides">) => {
      await deleteSlideMutation({ slideId })
    },
    deletePresentation: async (presentationId: Id<"presentations">) => {
      await removeMutation({ presentationId })
    },
    batchDeletePresentations: async (ids: Id<"presentations">[]) => {
      await batchRemoveMutation({ presentationIds: ids })
    },
    batchMovePresentations: async (ids: Id<"presentations">[], folderId: Id<"folders"> | null) => {
      await batchMoveMutation({ presentationIds: ids, folderId: folderId ?? undefined })
    },
    restorePresentations: async (ids: Id<"presentations">[]) => {
      await restoreMutation({ presentationIds: ids })
    },
    permanentDeletePresentations: async (ids: Id<"presentations">[]) => {
      await permanentDeleteMutation({ presentationIds: ids })
    },
  }
}

export function useAi() {
  const generateQuiz = useAction(api.ai.generateQuiz)
  const generateCrossword = useAction(api.ai.generateCrossword)
  const generatePresentation = useAction(api.ai.generatePresentation)
  const adjustCredits = useMutation(api.users.adjustCredits)

  return {
    generateQuiz: async (userId: Id<"users">, topic: string, description?: string, folderId?: Id<"folders">, questionCount?: number, difficulty?: string, language?: string) => {
      return await generateQuiz({ userId, topic, description, folderId, questionCount, difficulty, language })
    },
    generateCrossword: async (userId: Id<"users">, topic: string, description?: string, folderId?: Id<"folders">, difficulty?: string, language?: string, gridSize?: number, wordCount?: number) => {
      return await generateCrossword({ userId, topic, description, folderId, difficulty, language, gridSize, wordCount })
    },
    generatePresentation: async (userId: Id<"users">, topic: string, description?: string, folderId?: Id<"folders">, language?: string, theme?: string, size?: string, density?: string, style?: string, audience?: string, slideCount?: number) => {
      return await generatePresentation({ userId, topic, description, folderId, language, theme, size, density, style, audience, slideCount })
    },
    adjustCredits: async (userId: Id<"users">, amount: number) => {
      await adjustCredits({ userId, amount })
    },
  }
}

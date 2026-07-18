import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    telegramId: v.optional(v.float64()),
    telegramUsername: v.optional(v.string()),
    email: v.optional(v.string()),
    authProvider: v.string(),
    username: v.optional(v.string()),
    displayName: v.string(),
    photoUrl: v.optional(v.string()),
    languageCode: v.string(),
    credits: v.float64(),
    creditsRefreshAt: v.float64(),
    isTestUser: v.boolean(),
    deletedAt: v.optional(v.float64()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_telegram_id", ["telegramId"])
    .index("by_username", ["username"]),

  folders: defineTable({
    userId: v.id("users"),
    parentId: v.optional(v.id("folders")),
    name: v.string(),
    deletedAt: v.optional(v.float64()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_deleted", ["userId", "deletedAt"]),

  files: defineTable({
    userId: v.id("users"),
    originalName: v.string(),
    storageKey: v.string(),
    mimeType: v.string(),
    sizeBytes: v.float64(),
  })
    .index("by_user_id", ["userId"]),

  quizzes: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.string(),
    sourceFileId: v.optional(v.id("files")),
    questionCount: v.float64(),
    difficulty: v.optional(v.string()),
    language: v.optional(v.string()),
    deletedAt: v.optional(v.float64()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_folder", ["userId", "folderId"])
    .index("by_user_deleted", ["userId", "deletedAt"]),

  questions: defineTable({
    quizId: v.id("quizzes"),
    text: v.string(),
    options: v.array(v.string()),
    correctIndex: v.float64(),
    explanation: v.optional(v.string()),
    order: v.float64(),
  })
    .index("by_quiz_id", ["quizId"])
    .index("by_quiz_order", ["quizId", "order"]),

  quizSessions: defineTable({
    quizId: v.id("quizzes"),
    userId: v.id("users"),
    mode: v.string(),
    status: v.string(),
    score: v.optional(v.float64()),
    total: v.optional(v.float64()),
    skippedCount: v.float64(),
    timeSeconds: v.optional(v.float64()),
    completedAt: v.optional(v.float64()),
  })
    .index("by_user_id", ["userId"])
    .index("by_quiz_id", ["quizId"])
    .index("by_user_status", ["userId", "status"]),

  questionResponses: defineTable({
    sessionId: v.id("quizSessions"),
    questionId: v.id("questions"),
    selectedIndex: v.optional(v.float64()),
    isCorrect: v.boolean(),
    isSkipped: v.boolean(),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_session_question", ["sessionId", "questionId"]),

  shareLinks: defineTable({
    quizId: v.optional(v.id("quizzes")),
    crosswordId: v.optional(v.id("crosswords")),
    itemType: v.string(),
    createdBy: v.id("users"),
    token: v.string(),
    active: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_quiz_id", ["quizId"])
    .index("by_crossword_id", ["crosswordId"]),

  questionReports: defineTable({
    reporterId: v.id("users"),
    ownerId: v.id("users"),
    questionId: v.id("questions"),
    reason: v.string(),
    comment: v.optional(v.string()),
    status: v.string(),
  })
    .index("by_question_id", ["questionId"])
    .index("by_status", ["status"]),

  crosswords: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.string(),
    difficulty: v.optional(v.string()),
    language: v.optional(v.string()),
    gridWidth: v.optional(v.float64()),
    gridHeight: v.optional(v.float64()),
    deletedAt: v.optional(v.float64()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_folder", ["userId", "folderId"])
    .index("by_user_deleted", ["userId", "deletedAt"]),

  crosswordClues: defineTable({
    crosswordId: v.id("crosswords"),
    word: v.string(),
    clue: v.string(),
    row: v.optional(v.float64()),
    col: v.optional(v.float64()),
    direction: v.string(),
    number: v.float64(),
    order: v.float64(),
  })
    .index("by_crossword_id", ["crosswordId"])
    .index("by_crossword_order", ["crosswordId", "order"]),

  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    type: v.string(),
    sent: v.boolean(),
    sentAt: v.optional(v.float64()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_sent", ["userId", "sent"]),

  sharedAttempts: defineTable({
    shareLinkId: v.id("shareLinks"),
    participantName: v.optional(v.string()),
    score: v.optional(v.float64()),
    total: v.optional(v.float64()),
    completed: v.boolean(),
    timeSeconds: v.optional(v.float64()),
    data: v.optional(v.any()),
    createdAt: v.float64(),
  })
    .index("by_share_link", ["shareLinkId"]),

  presentations: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.string(),
    language: v.optional(v.string()),
    theme: v.optional(v.string()),
    size: v.optional(v.string()),
    density: v.optional(v.string()),
    style: v.optional(v.string()),
    audience: v.optional(v.string()),
    slideCount: v.optional(v.float64()),
    showWatermark: v.optional(v.boolean()),
    deletedAt: v.optional(v.float64()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_folder", ["userId", "folderId"])
    .index("by_user_deleted", ["userId", "deletedAt"]),

  presentationSlides: defineTable({
    presentationId: v.id("presentations"),
    title: v.string(),
    content: v.array(v.string()),
    layout: v.string(),
    order: v.float64(),
    imageUrl: v.optional(v.string()),
    fontSize: v.optional(v.string()),
    speakerNotes: v.optional(v.string()),
  })
    .index("by_presentation_id", ["presentationId"])
    .index("by_presentation_order", ["presentationId", "order"]),
})

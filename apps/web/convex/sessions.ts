import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const start = mutation({
  args: {
    quizId: v.id("quizzes"),
    userId: v.id("users"),
    mode: v.string(),
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", args.quizId))
      .collect()

    const sessionId = await ctx.db.insert("quizSessions", {
      quizId: args.quizId,
      userId: args.userId,
      mode: args.mode,
      status: "in_progress",
      skippedCount: 0,
    })

    return { sessionId, questions }
  },
})

export const get = query({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) return null

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", session.quizId))
      .collect()

    const responses = await ctx.db
      .query("questionResponses")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    return { session, questions, responses }
  },
})

export const submitAnswer = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    questionId: v.id("questions"),
    selectedIndex: v.float64(),
  },
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.questionId)
    if (!question) throw new Error("Question not found")

    const isCorrect = args.selectedIndex === question.correctIndex

    const existing = await ctx.db
      .query("questionResponses")
      .withIndex("by_session_question", (q) =>
        q.eq("sessionId", args.sessionId).eq("questionId", args.questionId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        selectedIndex: args.selectedIndex,
        isCorrect,
        isSkipped: false,
      })
    } else {
      await ctx.db.insert("questionResponses", {
        sessionId: args.sessionId,
        questionId: args.questionId,
        selectedIndex: args.selectedIndex,
        isCorrect,
        isSkipped: false,
      })
    }
  },
})

export const skipQuestion = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    questionId: v.id("questions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("questionResponses")
      .withIndex("by_session_question", (q) =>
        q.eq("sessionId", args.sessionId).eq("questionId", args.questionId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { isSkipped: true, isCorrect: false })
    } else {
      await ctx.db.insert("questionResponses", {
        sessionId: args.sessionId,
        questionId: args.questionId,
        isCorrect: false,
        isSkipped: true,
      })
    }

    const session = await ctx.db.get(args.sessionId)
    if (session) {
      await ctx.db.patch(args.sessionId, { skippedCount: (session.skippedCount ?? 0) + 1 })
    }
  },
})

export const complete = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    timeSeconds: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const responses = await ctx.db
      .query("questionResponses")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    const total = responses.length
    const correct = responses.filter((r) => r.isCorrect).length

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      score: correct,
      total,
      timeSeconds: args.timeSeconds,
      completedAt: Date.now(),
    })

    return { correct, total }
  },
})

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quizSessions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect()
  },
})

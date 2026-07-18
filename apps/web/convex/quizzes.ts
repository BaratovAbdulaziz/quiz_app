import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const list = query({
  args: {
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("quizzes")
      .withIndex("by_user_deleted", (idx) =>
        idx.eq("userId", args.userId).eq("deletedAt", undefined),
      )

    if (args.folderId) {
      q = q.filter((f) => f.eq(f.field("folderId"), args.folderId))
    }

    let results = await q.collect()

    if (args.search) {
      const s = args.search.toLowerCase()
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(s) ||
          (r.description && r.description.toLowerCase().includes(s)),
      )
    }

    return results
  },
})

export const listTrash = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quizzes")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect()
  },
})

export const get = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId)
    if (!quiz) return null
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", args.quizId))
      .collect()
    return { ...quiz, questions }
  },
})

export const create = mutation({
  args: {
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.string(),
    sourceFileId: v.optional(v.id("files")),
    questionCount: v.float64(),
    difficulty: v.optional(v.string()),
    language: v.optional(v.string()),
    questions: v.array(
      v.object({
        text: v.string(),
        options: v.array(v.string()),
        correctIndex: v.float64(),
        explanation: v.optional(v.string()),
        order: v.float64(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { questions: qs, userId, ...quizData } = args
    const quizId = await ctx.db.insert("quizzes", {
      ...quizData,
      userId,
      questionCount: qs.length,
    })
    for (const q of qs) {
      await ctx.db.insert("questions", {
        quizId,
        ...q,
      })
    }
    return quizId
  },
})

export const update = mutation({
  args: {
    quizId: v.id("quizzes"),
    title: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { quizId, ...updates } = args
    const patch: Record<string, any> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.folderId !== undefined) patch.folderId = updates.folderId
    await ctx.db.patch(quizId, patch)
  },
})

export const remove = mutation({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, { deletedAt: Date.now() })
  },
})

export const batchRemove = mutation({
  args: { quizIds: v.array(v.id("quizzes")) },
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const id of args.quizIds) {
      await ctx.db.patch(id, { deletedAt: now })
    }
  },
})

export const batchMove = mutation({
  args: {
    quizIds: v.array(v.id("quizzes")),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    for (const id of args.quizIds) {
      await ctx.db.patch(id, { folderId: args.folderId ?? undefined })
    }
  },
})

export const restore = mutation({
  args: { quizIds: v.array(v.id("quizzes")) },
  handler: async (ctx, args) => {
    for (const id of args.quizIds) {
      await ctx.db.patch(id, { deletedAt: undefined })
    }
  },
})

export const permanentDelete = mutation({
  args: { quizIds: v.array(v.id("quizzes")) },
  handler: async (ctx, args) => {
    for (const id of args.quizIds) {
      const sessions = await ctx.db
        .query("quizSessions")
        .withIndex("by_quiz_id", (q) => q.eq("quizId", id))
        .collect()
      for (const s of sessions) {
        const sessionResponses = await ctx.db
          .query("questionResponses")
          .withIndex("by_session_id", (q) => q.eq("sessionId", s._id))
          .collect()
        for (const r of sessionResponses) await ctx.db.delete(r._id)
        await ctx.db.delete(s._id)
      }

      const questions = await ctx.db
        .query("questions")
        .withIndex("by_quiz_id", (q) => q.eq("quizId", id))
        .collect()
      for (const q of questions) await ctx.db.delete(q._id)

      const links = await ctx.db
        .query("shareLinks")
        .withIndex("by_quiz_id", (q) => q.eq("quizId", id))
        .collect()
      for (const l of links) await ctx.db.delete(l._id)

      await ctx.db.delete(id)
    }
  },
})

import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const generateLink = mutation({
  args: {
    quizId: v.id("quizzes"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    const id = await ctx.db.insert("shareLinks", {
      quizId: args.quizId,
      createdBy: args.userId,
      token,
      active: true,
      itemType: "quiz",
    })
    return { id, token }
  },
})

export const generateCrosswordLink = mutation({
  args: {
    crosswordId: v.id("crosswords"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    const id = await ctx.db.insert("shareLinks", {
      crosswordId: args.crosswordId,
      createdBy: args.userId,
      token,
      active: true,
      itemType: "crossword",
    })
    return { id, token }
  },
})

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!link || !link.active) return null

    if (link.itemType === "crossword") {
      const crossword = await ctx.db.get(link.crosswordId!)
      if (!crossword || crossword.deletedAt) return null

      const clues = await ctx.db
        .query("crosswordClues")
        .withIndex("by_crossword_order", (q) => q.eq("crosswordId", link.crosswordId!))
        .collect()

      return { link, crossword, clues, itemType: "crossword" }
    }

    const quiz = await ctx.db.get(link.quizId!)
    if (!quiz || quiz.deletedAt) return null

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", link.quizId!))
      .collect()

    return { link, quiz, questions, itemType: "quiz" }
  },
})

export const importQuiz = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first()

    if (!link || !link.active) throw new Error("Share link not found or inactive")

    if (link.itemType === "crossword") {
      const original = await ctx.db.get(link.crosswordId!)
      if (!original) throw new Error("Crossword not found")

      const crosswordId = await ctx.db.insert("crosswords", {
        userId: args.userId,
        title: original.title + " (imported)",
        description: original.description,
        source: original.source,
        difficulty: original.difficulty,
        language: original.language,
        gridWidth: original.gridWidth,
        gridHeight: original.gridHeight,
      })

      const clues = await ctx.db
        .query("crosswordClues")
        .withIndex("by_crossword_order", (q) => q.eq("crosswordId", link.crosswordId!))
        .collect()

      for (const c of clues) {
        await ctx.db.insert("crosswordClues", {
          crosswordId,
          word: c.word,
          clue: c.clue,
          row: c.row,
          col: c.col,
          direction: c.direction,
          number: c.number,
          order: c.order,
        })
      }

      return crosswordId
    }

    const original = await ctx.db.get(link.quizId!)
    if (!original) throw new Error("Quiz not found")

    const quizId = await ctx.db.insert("quizzes", {
      userId: args.userId,
      title: original.title + " (imported)",
      description: original.description,
      source: original.source,
      questionCount: original.questionCount,
    })

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_quiz_order", (q) => q.eq("quizId", link.quizId!))
      .collect()

    for (const q of questions) {
      await ctx.db.insert("questions", {
        quizId,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        order: q.order,
      })
    }

    return quizId
  },
})

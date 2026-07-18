import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const create = mutation({
  args: {
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.string(),
    difficulty: v.optional(v.string()),
    language: v.optional(v.string()),
    gridWidth: v.optional(v.float64()),
    gridHeight: v.optional(v.float64()),
    clues: v.array(
      v.object({
        word: v.string(),
        clue: v.string(),
        row: v.optional(v.float64()),
        col: v.optional(v.float64()),
        direction: v.string(),
        number: v.float64(),
        order: v.float64(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { clues: cls, ...crosswordData } = args
    const crosswordId = await ctx.db.insert("crosswords", crosswordData)
    for (const c of cls) {
      await ctx.db.insert("crosswordClues", { crosswordId, ...c })
    }
    return crosswordId
  },
})

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crosswords")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId).eq("deletedAt", undefined))
      .collect()
  },
})

export const listTrash = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crosswords")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId).gt("deletedAt", 0))
      .collect()
  },
})

export const get = query({
  args: { crosswordId: v.id("crosswords") },
  handler: async (ctx, args) => {
    const crossword = await ctx.db.get(args.crosswordId)
    if (!crossword) return null
    const clues = await ctx.db
      .query("crosswordClues")
      .withIndex("by_crossword_order", (q) => q.eq("crosswordId", args.crosswordId))
      .collect()
    return { ...crossword, clues }
  },
})

export const update = mutation({
  args: {
    crosswordId: v.id("crosswords"),
    title: v.optional(v.string()),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { crosswordId, ...updates } = args
    const patch: Record<string, any> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.folderId !== undefined) patch.folderId = updates.folderId ?? undefined
    if (updates.description !== undefined) patch.description = updates.description
    await ctx.db.patch(crosswordId, patch)
  },
})

export const batchMove = mutation({
  args: {
    crosswordIds: v.array(v.id("crosswords")),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    for (const id of args.crosswordIds) {
      await ctx.db.patch(id, { folderId: args.folderId ?? undefined })
    }
  },
})

export const remove = mutation({
  args: { crosswordId: v.id("crosswords") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.crosswordId, { deletedAt: Date.now() })
  },
})

export const batchRemove = mutation({
  args: { crosswordIds: v.array(v.id("crosswords")) },
  handler: async (ctx, args) => {
    for (const id of args.crosswordIds) {
      await ctx.db.patch(id, { deletedAt: Date.now() })
    }
  },
})

export const restore = mutation({
  args: { crosswordIds: v.array(v.id("crosswords")) },
  handler: async (ctx, args) => {
    for (const id of args.crosswordIds) {
      await ctx.db.patch(id, { deletedAt: undefined })
    }
  },
})

export const permanentDelete = mutation({
  args: { crosswordIds: v.array(v.id("crosswords")) },
  handler: async (ctx, args) => {
    for (const id of args.crosswordIds) {
      const clues = await ctx.db
        .query("crosswordClues")
        .withIndex("by_crossword_id", (q) => q.eq("crosswordId", id))
        .collect()
      for (const c of clues) {
        await ctx.db.delete(c._id)
      }
      await ctx.db.delete(id)
    }
  },
})

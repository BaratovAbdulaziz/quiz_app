import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const record = mutation({
  args: {
    shareLinkId: v.id("shareLinks"),
    participantName: v.optional(v.string()),
    score: v.optional(v.float64()),
    total: v.optional(v.float64()),
    completed: v.boolean(),
    timeSeconds: v.optional(v.float64()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sharedAttempts", {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const getByShareLink = query({
  args: { shareLinkId: v.id("shareLinks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sharedAttempts")
      .withIndex("by_share_link", (q) => q.eq("shareLinkId", args.shareLinkId))
      .collect()
  },
})

export const getMyContentStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("shareLinks")
      .filter((q) => q.eq(q.field("createdBy"), args.userId))
      .collect()

    const result = []
    for (const link of links) {
      const attempts = await ctx.db
        .query("sharedAttempts")
        .withIndex("by_share_link", (q) => q.eq("shareLinkId", link._id))
        .collect()

      let contentTitle = "Unknown"
      if (link.itemType === "crossword" && link.crosswordId) {
        const c = await ctx.db.get(link.crosswordId)
        if (c) contentTitle = c.title
      } else if (link.quizId) {
        const q = await ctx.db.get(link.quizId)
        if (q) contentTitle = q.title
      }

      const scored = attempts.filter((a) => a.score != null && a.total != null && a.total > 0)
      const avgPct =
        scored.length > 0
          ? scored.reduce((s, a) => s + ((a.score ?? 0) / (a.total ?? 1)) * 100, 0) /
            scored.length
          : 0

      result.push({
        linkId: link._id,
        token: link.token,
        itemType: link.itemType,
        contentTitle,
        attemptCount: attempts.length,
        completedCount: attempts.filter((a) => a.completed).length,
        avgPercentage: Math.round(avgPct * 10) / 10,
        attempts,
      })
    }

    return result
  },
})

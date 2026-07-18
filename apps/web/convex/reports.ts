import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const create = mutation({
  args: {
    reporterId: v.id("users"),
    ownerId: v.id("users"),
    questionId: v.id("questions"),
    reason: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("questionReports", {
      ...args,
      status: "pending",
    })
  },
})

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("questionReports")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect()
    }
    return await ctx.db.query("questionReports").collect()
  },
})

export const updateStatus = mutation({
  args: {
    reportId: v.id("questionReports"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { status: args.status })
  },
})

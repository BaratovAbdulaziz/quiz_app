import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("folders")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId).eq("deletedAt", undefined))
      .collect()
  },
})

export const listTrash = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("folders")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect()
  },
})

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("folders", {
      userId: args.userId,
      name: args.name,
    })
  },
})

export const rename = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.folderId, { name: args.name })
  },
})

export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.folderId, { deletedAt: Date.now() })
  },
})

export const batchRemove = mutation({
  args: { folderIds: v.array(v.id("folders")) },
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const id of args.folderIds) {
      await ctx.db.patch(id, { deletedAt: now })
    }
  },
})

export const restore = mutation({
  args: { folderIds: v.array(v.id("folders")) },
  handler: async (ctx, args) => {
    for (const id of args.folderIds) {
      await ctx.db.patch(id, { deletedAt: undefined })
    }
  },
})

export const permanentDelete = mutation({
  args: { folderIds: v.array(v.id("folders")) },
  handler: async (ctx, args) => {
    for (const id of args.folderIds) {
      await ctx.db.delete(id)
    }
  },
})

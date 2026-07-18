import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    credits: v.optional(v.float64()),
    creditsRefreshAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first()

    if (existing) {
      const patch: Record<string, unknown> = {
        email: args.email,
        displayName: args.displayName,
        photoUrl: args.imageUrl,
      }
      if (args.credits !== undefined) patch.credits = args.credits
      if (args.creditsRefreshAt !== undefined) patch.creditsRefreshAt = args.creditsRefreshAt
      await ctx.db.patch(existing._id, patch)
      return { userId: existing._id, isNew: false }
    }

    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      displayName: args.displayName ?? "User",
      photoUrl: args.imageUrl,
      authProvider: "clerk",
      languageCode: "en",
      credits: args.credits ?? 100,
      creditsRefreshAt: args.creditsRefreshAt ?? Date.now() + 86400000,
      isTestUser: false,
    })
    return { userId: id, isNew: true }
  },
})

export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first()
  },
})

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})

export const loginWithTelegram = mutation({
  args: {
    telegramId: v.float64(),
    telegramUsername: v.optional(v.string()),
    displayName: v.string(),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        telegramUsername: args.telegramUsername,
        displayName: args.displayName,
        photoUrl: args.photoUrl,
      })
      return existing._id
    }

    return await ctx.db.insert("users", {
      clerkId: "",
      telegramId: args.telegramId,
      telegramUsername: args.telegramUsername,
      displayName: args.displayName,
      photoUrl: args.photoUrl,
      authProvider: "telegram",
      languageCode: "en",
      credits: 100,
      creditsRefreshAt: Date.now() + 86400000,
      isTestUser: false,
    })
  },
})

export const updateSettings = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    languageCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args
    await ctx.db.patch(userId, updates)
  },
})

export const checkUsername = query({
  args: { username: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first()
    if (!user) return { available: true }
    if (args.excludeUserId && user._id === args.excludeUserId) return { available: true }
    return { available: false, message: "Username is taken" }
  },
})

export const deleteAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.userId)
  },
})

export const listUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect()
  },
})

export const adjustCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.float64(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error("User not found")
    await ctx.db.patch(args.userId, { credits: Math.max(0, user.credits + args.amount) })
  },
})

export const adjustCreditsByClerkId = mutation({
  args: {
    clerkId: v.string(),
    amount: v.float64(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first()
    if (!user) throw new Error("User not found")
    await ctx.db.patch(user._id, { credits: Math.max(0, user.credits + args.amount) })
  },
})

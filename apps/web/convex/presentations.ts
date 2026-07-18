import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const create = mutation({
  args: {
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
    slides: v.array(
      v.object({
        title: v.string(),
        content: v.array(v.string()),
        layout: v.string(),
        order: v.float64(),
        speakerNotes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { slides: sl, ...presentationData } = args
    const presentationId = await ctx.db.insert("presentations", presentationData)
    for (const s of sl) {
      await ctx.db.insert("presentationSlides", { presentationId, ...s })
    }
    return presentationId
  },
})

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("presentations")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId).eq("deletedAt", undefined))
      .collect()
  },
})

export const listTrash = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("presentations")
      .withIndex("by_user_deleted", (q) => q.eq("userId", args.userId).gt("deletedAt", 0))
      .collect()
  },
})

export const get = query({
  args: { presentationId: v.id("presentations") },
  handler: async (ctx, args) => {
    const presentation = await ctx.db.get(args.presentationId)
    if (!presentation) return null
    const slides = await ctx.db
      .query("presentationSlides")
      .withIndex("by_presentation_order", (q) => q.eq("presentationId", args.presentationId))
      .collect()
    return { ...presentation, slides }
  },
})

export const listSlides = query({
  args: { presentationId: v.id("presentations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("presentationSlides")
      .withIndex("by_presentation_order", (q) => q.eq("presentationId", args.presentationId))
      .collect()
  },
})

export const update = mutation({
  args: {
    presentationId: v.id("presentations"),
    title: v.optional(v.string()),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
    description: v.optional(v.string()),
    theme: v.optional(v.string()),
    size: v.optional(v.string()),
    density: v.optional(v.string()),
    style: v.optional(v.string()),
    audience: v.optional(v.string()),
    slideCount: v.optional(v.float64()),
    showWatermark: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { presentationId, ...updates } = args
    const patch: Record<string, any> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.folderId !== undefined) patch.folderId = updates.folderId ?? undefined
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.theme !== undefined) patch.theme = updates.theme
    if (updates.size !== undefined) patch.size = updates.size
    if (updates.density !== undefined) patch.density = updates.density
    if (updates.style !== undefined) patch.style = updates.style
    if (updates.audience !== undefined) patch.audience = updates.audience
    if (updates.slideCount !== undefined) patch.slideCount = updates.slideCount
    if (updates.showWatermark !== undefined) patch.showWatermark = updates.showWatermark
    await ctx.db.patch(presentationId, patch)
  },
})

export const updateSlideImage = mutation({
  args: {
    slideId: v.id("presentationSlides"),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.slideId, { imageUrl: args.imageUrl })
  },
})

export const updateSlide = mutation({
  args: {
    slideId: v.id("presentationSlides"),
    title: v.optional(v.string()),
    content: v.optional(v.array(v.string())),
    layout: v.optional(v.string()),
    fontSize: v.optional(v.string()),
    speakerNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {}
    if (args.title !== undefined) patch.title = args.title
    if (args.content !== undefined) patch.content = args.content
    if (args.layout !== undefined) patch.layout = args.layout
    if (args.fontSize !== undefined) patch.fontSize = args.fontSize
    if (args.speakerNotes !== undefined) patch.speakerNotes = args.speakerNotes
    await ctx.db.patch(args.slideId, patch)
  },
})

export const reorderSlides = mutation({
  args: {
    slideIds: v.array(v.id("presentationSlides")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.slideIds.length; i++) {
      await ctx.db.patch(args.slideIds[i], { order: i })
    }
  },
})

export const addSlide = mutation({
  args: {
    presentationId: v.id("presentations"),
    title: v.string(),
    content: v.array(v.string()),
    layout: v.string(),
    order: v.float64(),
    fontSize: v.optional(v.string()),
    speakerNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("presentationSlides", {
      presentationId: args.presentationId,
      title: args.title,
      content: args.content,
      layout: args.layout,
      order: args.order,
      fontSize: args.fontSize,
      speakerNotes: args.speakerNotes,
    })
  },
})

export const deleteSlide = mutation({
  args: {
    slideId: v.id("presentationSlides"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.slideId)
  },
})

export const batchMove = mutation({
  args: {
    presentationIds: v.array(v.id("presentations")),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    for (const id of args.presentationIds) {
      await ctx.db.patch(id, { folderId: args.folderId ?? undefined })
    }
  },
})

export const remove = mutation({
  args: { presentationId: v.id("presentations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.presentationId, { deletedAt: Date.now() })
  },
})

export const batchRemove = mutation({
  args: { presentationIds: v.array(v.id("presentations")) },
  handler: async (ctx, args) => {
    for (const id of args.presentationIds) {
      await ctx.db.patch(id, { deletedAt: Date.now() })
    }
  },
})

export const restore = mutation({
  args: { presentationIds: v.array(v.id("presentations")) },
  handler: async (ctx, args) => {
    for (const id of args.presentationIds) {
      await ctx.db.patch(id, { deletedAt: undefined })
    }
  },
})

export const permanentDelete = mutation({
  args: { presentationIds: v.array(v.id("presentations")) },
  handler: async (ctx, args) => {
    for (const id of args.presentationIds) {
      const slides = await ctx.db
        .query("presentationSlides")
        .withIndex("by_presentation_id", (q) => q.eq("presentationId", id))
        .collect()
      for (const s of slides) {
        await ctx.db.delete(s._id)
      }
      await ctx.db.delete(id)
    }
  },
})

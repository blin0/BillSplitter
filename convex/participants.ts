import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Queries ───────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("participants")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const add = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId  = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name cannot be empty.");
    return await ctx.db.insert("participants", { userId, name: trimmed });
  },
});

export const remove = mutation({
  args: { id: v.id("participants") },
  handler: async (ctx, { id }) => {
    const userId      = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const participant = await ctx.db.get(id);
    if (!participant || participant.userId !== userId) throw new Error("Unauthorized");

    // Cascade-delete expenses paid by this participant
    const paid = await ctx.db
      .query("expenses")
      .filter(q => q.eq(q.field("paidBy"), id))
      .collect();
    await Promise.all(paid.map(e => ctx.db.delete(e._id)));
    await ctx.db.delete(id);
  },
});

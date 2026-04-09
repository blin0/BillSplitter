import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// ── Shared validator for a single split ──────────────────────────────────────

const splitValidator = v.object({
  participantId: v.id("participants"),
  share:         v.number(),
  paidAmount:    v.number(),
  isSettled:     v.boolean(),
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("expenses")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const add = mutation({
  args: {
    description:          v.string(),
    totalAmount:          v.number(),
    sourceAmount:         v.number(),
    sourceCurrency:       v.string(),
    lockedRate:           v.number(),
    paidBy:               v.id("participants"),
    splitType:            v.union(v.literal("equally"), v.literal("exact")),
    involvedParticipants: v.array(v.id("participants")),
    splits:               v.array(splitValidator),
    taxPercent:           v.optional(v.number()),
    tipSourceAmount:      v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("expenses", { ...args, userId, isHighlighted: false });
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    const userId  = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const expense = await ctx.db.get(id);
    if (!expense || expense.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.delete(id);
  },
});

export const toggleHighlight = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    const userId  = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const expense = await ctx.db.get(id);
    if (!expense || expense.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(id, { isHighlighted: !expense.isHighlighted });
  },
});

export const highlightUnsettled = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const all = await ctx.db
      .query("expenses")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    await Promise.all(
      all.map(e =>
        ctx.db.patch(e._id, { isHighlighted: e.splits.some(s => !s.isSettled) })
      )
    );
  },
});

export const applyPayment = mutation({
  args: {
    from:            v.id("participants"),
    to:              v.id("participants"),
    amount:          v.number(),
    highlightedOnly: v.boolean(),
  },
  handler: async (ctx, { from, to, amount, highlightedOnly }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
    if (highlightedOnly) expenses = expenses.filter(e => e.isHighlighted);

    type Ticket = { expenseId: Id<"expenses">; splitIdx: number; owed: number };
    const tickets: Ticket[] = [];
    for (const e of expenses) {
      if (e.paidBy !== to) continue;
      e.splits.forEach((s, i) => {
        if (s.participantId !== from) return;
        const owed = round2(s.share - s.paidAmount);
        if (owed > 0.01) tickets.push({ expenseId: e._id, splitIdx: i, owed });
      });
    }
    tickets.sort((a, b) => a.owed - b.owed);

    let remaining = amount;
    for (const { expenseId, splitIdx, owed } of tickets) {
      if (remaining <= 0.005) break;
      const expense = await ctx.db.get(expenseId);
      if (!expense) continue;
      const payment   = Math.min(owed, remaining);
      remaining       = round2(remaining - payment);
      const newSplits = expense.splits.map((s, i) => {
        if (i !== splitIdx) return s;
        const newPaid = round2(s.paidAmount + payment);
        return { ...s, paidAmount: newPaid, isSettled: newPaid >= s.share - 0.005 };
      });
      await ctx.db.patch(expenseId, { splits: newSplits });
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

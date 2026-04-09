import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // ── Convex Auth built-in tables (users, sessions, etc.) ──────────────────
  ...authTables,

  /**
   * Group members. Scoped per authenticated user so each account
   * has its own participant list.
   */
  participants: defineTable({
    userId: v.id("users"),
    name:   v.string(),
  }).index("by_user", ["userId"]),

  /**
   * Expenses. Splits are embedded as an array — they always belong to exactly
   * one expense, so a separate table would only add join overhead.
   *
   * All monetary values are stored in the group's base currency, locked at
   * save time (matches the frontend's `lockedRate` convention).
   */
  expenses: defineTable({
    userId:                v.id("users"),
    description:           v.string(),
    /** Grand total in base currency (subtotal + tax + tip). */
    totalAmount:           v.number(),
    /** Amount the user actually typed, in sourceCurrency. */
    sourceAmount:          v.number(),
    /** Currency the user paid in, e.g. "CNY". */
    sourceCurrency:        v.string(),
    /** 1 sourceCurrency = lockedRate baseCurrency, frozen at save time. */
    lockedRate:            v.number(),
    paidBy:                v.id("participants"),
    splitType:             v.union(v.literal("equally"), v.literal("exact")),
    involvedParticipants:  v.array(v.id("participants")),
    splits:                v.array(v.object({
      participantId: v.id("participants"),
      /** Share owed in base currency. */
      share:         v.number(),
      /** Amount already paid toward this share. */
      paidAmount:    v.number(),
      /** True when paidAmount >= share. */
      isSettled:     v.boolean(),
    })),
    /** Whether selected in the Selective Settlement panel. */
    isHighlighted:         v.boolean(),
    /** e.g. 8 means 8%. Omitted when no tax. */
    taxPercent:            v.optional(v.number()),
    /** Flat tip in sourceCurrency. Omitted when no tip. */
    tipSourceAmount:       v.optional(v.number()),
  }).index("by_user", ["userId"]),
});

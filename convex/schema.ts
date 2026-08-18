import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cocAccounts: defineTable({
    userId: v.string(),
    tag: v.string(),
    name: v.string(),
    townHallLevel: v.number(),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_tag", ["userId", "tag"])
    .index("by_user_and_order", ["userId", "order"]),

  // A point-in-time capture of a player's base, straight from the CoC API.
  // We keep the full raw payload so future phases (progress tracking,
  // diffing over time) don't require re-fetching or a schema change.
  baseSnapshots: defineTable({
    tag: v.string(),
    name: v.string(),
    townHallLevel: v.number(),
    raw: v.any(),
    fetchedAt: v.number(),
    // Private village exports are scoped to the Better Auth user/account.
    userId: v.optional(v.string()),
    cocAccountId: v.optional(v.id("cocAccounts")),
    // "api" (from the official API) or "export" (in-game village-data JSON).
    source: v.optional(v.string()),
    // Unix seconds from the export's own timestamp, when source == "export".
    exportTimestamp: v.optional(v.number()),
  })
    .index("by_tag", ["tag"])
    .index("by_account", ["cocAccountId"]),
});

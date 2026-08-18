import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // A point-in-time capture of a player's base, straight from the CoC API.
  // We keep the full raw payload so future phases (progress tracking,
  // diffing over time) don't require re-fetching or a schema change.
  baseSnapshots: defineTable({
    tag: v.string(),
    name: v.string(),
    townHallLevel: v.number(),
    raw: v.any(),
    fetchedAt: v.number(),
    // "api" (from the official API) or "export" (in-game village-data JSON).
    source: v.optional(v.string()),
    // Unix seconds from the export's own timestamp, when source == "export".
    exportTimestamp: v.optional(v.number()),
  }).index("by_tag", ["tag"]),
});

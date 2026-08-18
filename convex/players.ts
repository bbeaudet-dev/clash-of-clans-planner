import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

// RoyaleAPI proxy lets us call the official CoC API from a host without a
// static IP. The token is whitelisted to the proxy IP (45.79.218.79), not ours.
const PROXY_BASE = "https://cocproxy.royaleapi.dev/v1";

/** Normalize any user-entered tag to the canonical "#ABC123" form. */
export function normalizeTag(input: string): string {
  const bare = input.trim().toUpperCase().replace(/^#/, "").replace(/O/g, "0");
  return `#${bare}`;
}

export const fetchPlayer = action({
  args: { tag: v.string() },
  handler: async (ctx, { tag }) => {
    const token = process.env.COC_API_TOKEN;
    if (!token) {
      throw new Error(
        "COC_API_TOKEN is not set. Run: npx convex env set COC_API_TOKEN <token>"
      );
    }

    const normalized = normalizeTag(tag);
    const encoded = encodeURIComponent(normalized); // "#" -> "%23"

    const res = await fetch(`${PROXY_BASE}/players/${encoded}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CoC API error ${res.status}: ${body || res.statusText}`);
    }

    const player = await res.json();

    await ctx.runMutation(internal.players.storeSnapshot, {
      tag: normalized,
      name: player.name ?? "Unknown",
      townHallLevel: player.townHallLevel ?? 0,
      raw: player,
    });

    return player;
  },
});

export const storeSnapshot = internalMutation({
  args: {
    tag: v.string(),
    name: v.string(),
    townHallLevel: v.number(),
    raw: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("baseSnapshots", {
      ...args,
      source: "api",
      fetchedAt: Date.now(),
    });
  },
});

// Public mutation: store a user-imported village-data export (no external
// fetch, so a plain mutation is fine).
export const importVillageData = mutation({
  args: {
    tag: v.string(),
    townHallLevel: v.number(),
    raw: v.any(),
    exportTimestamp: v.optional(v.number()),
    cocAccountId: v.optional(v.id("cocAccounts")),
  },
  handler: async (ctx, args) => {
    const tag = normalizeTag(args.tag);
    const user = await authComponent.safeGetAuthUser(ctx);
    if (args.cocAccountId) {
      if (!user) {
        throw new Error("You must be signed in to attach village data.");
      }
      const account = await ctx.db.get(args.cocAccountId);
      if (!account || account.userId !== user._id) {
        throw new Error("Account not found.");
      }
    }
    await ctx.db.insert("baseSnapshots", {
      tag,
      name: "Imported village data",
      townHallLevel: args.townHallLevel,
      raw: args.raw,
      source: "export",
      userId: user?._id,
      cocAccountId: args.cocAccountId,
      exportTimestamp: args.exportTimestamp,
      fetchedAt: Date.now(),
    });
    return { tag };
  },
});

export const latestSnapshot = query({
  args: { tag: v.string() },
  handler: async (ctx, { tag }) => {
    const normalized = normalizeTag(tag);
    return await ctx.db
      .query("baseSnapshots")
      .withIndex("by_tag", (q) => q.eq("tag", normalized))
      .order("desc")
      .filter((q) => q.eq(q.field("source"), "api"))
      .first();
  },
});

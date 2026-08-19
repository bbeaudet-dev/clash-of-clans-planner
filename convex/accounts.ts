import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { normalizeTag } from "./players";

type DbCtx = QueryCtx | MutationCtx;
const MAX_BUILDERS = 7;

function clampBuilderCount(builderCount: number): number {
  return Math.min(MAX_BUILDERS, Math.max(1, Math.floor(builderCount)));
}

async function currentUserId(ctx: DbCtx) {
  const user = await authComponent.getAuthUser(ctx);
  return user._id;
}

async function assertOwnsAccount(
  ctx: DbCtx,
  accountId: Id<"cocAccounts">,
  userId: string
) {
  const account = await ctx.db.get(accountId);
  if (!account || account.userId !== userId) {
    throw new ConvexError("Account not found.");
  }
  return account;
}

export const listMyAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUserId(ctx);
    return await ctx.db
      .query("cocAccounts")
      .withIndex("by_user_and_order", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const saveCurrentAccount = mutation({
  args: {
    tag: v.string(),
    name: v.string(),
    townHallLevel: v.number(),
    builderCount: v.optional(v.number()),
    goldPass: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    const tag = normalizeTag(args.tag);
    const now = Date.now();
    const builderCount =
      args.builderCount === undefined ? undefined : clampBuilderCount(args.builderCount);

    const existing = await ctx.db
      .query("cocAccounts")
      .withIndex("by_user_and_tag", (q) => q.eq("userId", userId).eq("tag", tag))
      .first();

    const accountId =
      existing?._id ??
      (await ctx.db.insert("cocAccounts", {
        userId,
        tag,
        name: args.name,
        townHallLevel: args.townHallLevel,
        builderCount: builderCount ?? 5,
        goldPass: args.goldPass ?? false,
        skips: [],
        order: now,
        createdAt: now,
        updatedAt: now,
      }));

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        townHallLevel: args.townHallLevel,
        builderCount: builderCount ?? existing.builderCount ?? 5,
        goldPass: args.goldPass ?? existing.goldPass ?? false,
        updatedAt: now,
      });
    }

    const recentExports = await ctx.db
      .query("baseSnapshots")
      .withIndex("by_tag", (q) => q.eq("tag", tag))
      .order("desc")
      .take(20);
    const unattachedExport = recentExports.find(
      (snapshot) =>
        snapshot.source === "export" &&
        snapshot.userId === userId &&
        snapshot.cocAccountId === undefined
    );
    if (unattachedExport) {
      await ctx.db.patch(unattachedExport._id, { cocAccountId: accountId });
    }

    return accountId;
  },
});

export const updateAccountSettings = mutation({
  args: {
    accountId: v.id("cocAccounts"),
    builderCount: v.number(),
    goldPass: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    await assertOwnsAccount(ctx, args.accountId, userId);
    await ctx.db.patch(args.accountId, {
      builderCount: clampBuilderCount(args.builderCount),
      goldPass: args.goldPass,
      updatedAt: Date.now(),
    });
  },
});

export const updateAccountSkips = mutation({
  args: {
    accountId: v.id("cocAccounts"),
    skips: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    await assertOwnsAccount(ctx, args.accountId, userId);
    await ctx.db.patch(args.accountId, {
      skips: args.skips,
      updatedAt: Date.now(),
    });
  },
});

export const renameAccount = mutation({
  args: {
    accountId: v.id("cocAccounts"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    await assertOwnsAccount(ctx, args.accountId, userId);
    await ctx.db.patch(args.accountId, {
      name: args.name.trim() || "Unnamed account",
      updatedAt: Date.now(),
    });
  },
});

export const deleteAccount = mutation({
  args: { accountId: v.id("cocAccounts") },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    await assertOwnsAccount(ctx, args.accountId, userId);
    const snapshots = await ctx.db
      .query("baseSnapshots")
      .withIndex("by_account", (q) => q.eq("cocAccountId", args.accountId))
      .collect();
    await Promise.all(snapshots.map((snapshot) => ctx.db.delete(snapshot._id)));
    await ctx.db.delete(args.accountId);
  },
});

export const reorderAccounts = mutation({
  args: { accountIds: v.array(v.id("cocAccounts")) },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    await Promise.all(
      args.accountIds.map(async (accountId, index) => {
        await assertOwnsAccount(ctx, accountId, userId);
        await ctx.db.patch(accountId, {
          order: index,
          updatedAt: Date.now(),
        });
      })
    );
  },
});

export const getAccountData = query({
  args: { accountId: v.id("cocAccounts") },
  handler: async (ctx, args) => {
    const userId = await currentUserId(ctx);
    const account = await assertOwnsAccount(ctx, args.accountId, userId);
    const apiSnapshot =
      (
        await ctx.db
          .query("baseSnapshots")
          .withIndex("by_tag", (q) => q.eq("tag", account.tag))
          .order("desc")
          .take(20)
      ).find((snapshot) => snapshot.source === "api") ?? null;
    const exportSnapshot = await ctx.db
      .query("baseSnapshots")
      .withIndex("by_account", (q) => q.eq("cocAccountId", args.accountId))
      .order("desc")
      .first();

    return { account, apiSnapshot, exportSnapshot };
  },
});

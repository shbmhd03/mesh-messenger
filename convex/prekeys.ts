import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upload prekey bundle.
 */
export const save = mutation({
  args: {
    nodeId: v.string(),
    bundle: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prekeys")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bundle: args.bundle,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("prekeys", {
        nodeId: args.nodeId,
        bundle: args.bundle,
        updatedAt: now,
      });
    }
  },
});

/**
 * Fetch prekey bundle.
 */
export const get = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prekeys")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    return existing ? JSON.parse(existing.bundle) : null;
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Register or update a NodeID.
 */
export const register = mutation({
  args: {
    nodeId: v.string(),
    ipAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("registrations")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ipAddress: args.ipAddress,
        registeredAt: now,
      });
    } else {
      await ctx.db.insert("registrations", {
        nodeId: args.nodeId,
        ipAddress: args.ipAddress,
        registeredAt: now,
      });
    }
  },
});

/**
 * Check if a NodeID is registered.
 */
export const isRegistered = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("registrations")
      .withIndex("by_nodeId", (q) => q.eq("nodeId", args.nodeId))
      .first();
    return !!existing;
  },
});

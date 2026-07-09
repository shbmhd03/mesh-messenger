import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_QUEUE_BYTES = 5 * 1024 * 1024; // 5 MB per node

/**
 * Enqueue packet for a destination NodeID.
 * Returns true if stored, false if quota exceeded.
 */
export const enqueue = mutation({
  args: {
    destNodeId: v.string(),
    packetId: v.string(),
    dataBase64: v.string(),
    sizeBytes: v.number(),
    ttlSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Calculate current queue size for destination
    const existingPackets = await ctx.db
      .query("packets")
      .withIndex("by_destNodeId", (q) => q.eq("destNodeId", args.destNodeId))
      .collect();

    let currentSize = 0;
    for (const p of existingPackets) {
      currentSize += p.sizeBytes;
    }

    if (currentSize + args.sizeBytes > MAX_QUEUE_BYTES) {
      return false; // Quota exceeded
    }

    const now = Date.now();

    // 2. Insert new packet
    await ctx.db.insert("packets", {
      destNodeId: args.destNodeId,
      packetId: args.packetId,
      dataBase64: args.dataBase64,
      storedAt: now,
      expiresAt: now + args.ttlSeconds * 1000,
      sizeBytes: args.sizeBytes,
    });

    return true;
  },
});

/**
 * Drain all packets for a destination NodeID.
 * Reads, filters expired, deletes from DB, and returns.
 */
export const drain = mutation({
  args: { destNodeId: v.string() },
  handler: async (ctx, args) => {
    const pkts = await ctx.db
      .query("packets")
      .withIndex("by_destNodeId", (q) => q.eq("destNodeId", args.destNodeId))
      .collect();

    const now = Date.now();
    const result: typeof pkts = [];

    for (const p of pkts) {
      // Delete packet from database
      await ctx.db.delete(p._id);
      
      // Keep only non-expired packets for delivery
      if (p.expiresAt > now) {
        result.push(p);
      }
    }

    return result.map((p) => ({
      packetId: p.packetId,
      dataBase64: p.dataBase64,
      storedAt: p.storedAt,
      expiresAt: p.expiresAt,
      sizeBytes: p.sizeBytes,
    }));
  },
});

/**
 * Get queue depth count.
 */
export const getQueueDepth = query({
  args: { destNodeId: v.string() },
  handler: async (ctx, args) => {
    const pkts = await ctx.db
      .query("packets")
      .withIndex("by_destNodeId", (q) => q.eq("destNodeId", args.destNodeId))
      .collect();
    return pkts.length;
  },
});

/**
 * Prune expired packets from database.
 */
export const pruneExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("packets")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();

    for (const p of expired) {
      await ctx.db.delete(p._id);
    }

    return expired.length;
  },
});

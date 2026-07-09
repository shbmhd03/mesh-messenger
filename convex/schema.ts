import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  registrations: defineTable({
    nodeId: v.string(),
    ipAddress: v.string(),
    registeredAt: v.number(),
  }).index("by_nodeId", ["nodeId"]),

  prekeys: defineTable({
    nodeId: v.string(),
    bundle: v.string(), // JSON string representing prekey bundle
    updatedAt: v.number(),
  }).index("by_nodeId", ["nodeId"]),

  packets: defineTable({
    destNodeId: v.string(),
    packetId: v.string(),
    dataBase64: v.string(),
    storedAt: v.number(),
    expiresAt: v.number(),
    sizeBytes: v.number(),
  })
    .index("by_destNodeId", ["destNodeId"])
    .index("by_expiresAt", ["expiresAt"]),
});

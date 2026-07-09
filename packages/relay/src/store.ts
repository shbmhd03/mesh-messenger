/**
 * @mesh/relay — Store-and-Forward Queue
 *
 * In-memory per-NodeID message queues with quota + TTL enforcement.
 * Swap to Redis/Postgres for production.
 */

export interface StoredPacket {
  packetId: string;        // hex
  data: Uint8Array;        // raw ciphertext frame
  storedAt: number;        // unix ms
  expiresAt: number;       // unix ms
  sizeBytes: number;
}

export interface QueueStats {
  nodeId: string;
  packetCount: number;
  totalBytes: number;
}

const MAX_QUEUE_BYTES = 5 * 1024 * 1024;   // 5 MB per node
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export class StoreAndForward {
  private queues: Map<string, StoredPacket[]> = new Map();
  private queueSizes: Map<string, number> = new Map();
  private dedupSet: Set<string> = new Set();

  /**
   * Enqueue a packet for a destination NodeID.
   * Returns false if quota exceeded or duplicate.
   */
  enqueue(destNodeId: string, packetId: string, data: Uint8Array, ttlMs = DEFAULT_TTL_MS): boolean {
    // Dedup
    if (this.dedupSet.has(packetId)) return false;

    const currentSize = this.queueSizes.get(destNodeId) ?? 0;
    if (currentSize + data.length > MAX_QUEUE_BYTES) {
      return false; // quota exceeded
    }

    const queue = this.queues.get(destNodeId) ?? [];
    const now = Date.now();

    queue.push({
      packetId,
      data: new Uint8Array(data),
      storedAt: now,
      expiresAt: now + ttlMs,
      sizeBytes: data.length,
    });

    this.queues.set(destNodeId, queue);
    this.queueSizes.set(destNodeId, currentSize + data.length);
    this.dedupSet.add(packetId);

    return true;
  }

  /**
   * Drain all queued packets for a node (when it comes online).
   * Removes packets from the queue and returns them.
   */
  drain(destNodeId: string): StoredPacket[] {
    const queue = this.queues.get(destNodeId);
    if (!queue || queue.length === 0) return [];

    const now = Date.now();
    const valid = queue.filter(p => p.expiresAt > now);
    const expired = queue.filter(p => p.expiresAt <= now);

    // Clean up dedup set for expired
    for (const p of expired) {
      this.dedupSet.delete(p.packetId);
    }

    // Remove the queue
    this.queues.delete(destNodeId);
    this.queueSizes.delete(destNodeId);

    // Clean up dedup for drained
    for (const p of valid) {
      this.dedupSet.delete(p.packetId);
    }

    return valid;
  }

  /**
   * Get queue depth for a specific node.
   */
  queueDepth(destNodeId: string): number {
    return this.queues.get(destNodeId)?.length ?? 0;
  }

  /**
   * Get overall stats.
   */
  stats(): { totalNodes: number; totalPackets: number; totalBytes: number } {
    let totalPackets = 0;
    let totalBytes = 0;
    for (const [, queue] of this.queues) {
      totalPackets += queue.length;
      for (const p of queue) totalBytes += p.sizeBytes;
    }
    return { totalNodes: this.queues.size, totalPackets, totalBytes };
  }

  /**
   * Prune all expired packets across all queues.
   */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [nodeId, queue] of this.queues) {
      const valid = queue.filter(p => p.expiresAt > now);
      pruned += queue.length - valid.length;

      for (const p of queue) {
        if (p.expiresAt <= now) this.dedupSet.delete(p.packetId);
      }

      if (valid.length === 0) {
        this.queues.delete(nodeId);
        this.queueSizes.delete(nodeId);
      } else {
        this.queues.set(nodeId, valid);
        let size = 0;
        for (const p of valid) size += p.sizeBytes;
        this.queueSizes.set(nodeId, size);
      }
    }

    return pruned;
  }
}

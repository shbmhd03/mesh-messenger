/**
 * @mesh/core — Routing
 *
 * Mesh routing primitives: deduplication cache, neighbor table,
 * HELLO beacon logic, and forwarding decisions.
 */

import {
  type NodeId,
  type PacketId,
  type MeshPacket,
  type HelloPayload,
  TransportType,
  BatteryClass,
  bytesEqual,
  nodeIdToHex,
} from './protocol.js';

// ── Deduplication Cache ────────────────────────────────────────────────────

/**
 * LRU dedup cache for packet IDs.
 * Drops duplicate packets silently before any other processing.
 *
 * Cap: ~5,000 entries, TTL: ~10 minutes
 */
export class DeduplicationCache {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly seen: Map<string, number>; // hex(packetId) → timestamp ms

  constructor(maxEntries = 5000, ttlMs = 10 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.seen = new Map();
  }

  /**
   * Check if a packet ID has been seen recently.
   * If not, records it and returns false (= process this packet).
   * If yes, returns true (= drop this packet).
   */
  isDuplicate(packetId: PacketId): boolean {
    const key = nodeIdToHex(packetId);
    const now = Date.now();

    // Prune expired entries periodically
    if (this.seen.size > this.maxEntries * 0.9) {
      this.prune(now);
    }

    const existing = this.seen.get(key);
    if (existing !== undefined && (now - existing) < this.ttlMs) {
      return true; // duplicate
    }

    this.seen.set(key, now);
    return false;
  }

  /** Number of entries currently tracked */
  get size(): number {
    return this.seen.size;
  }

  private prune(now: number): void {
    for (const [key, ts] of this.seen) {
      if ((now - ts) > this.ttlMs) {
        this.seen.delete(key);
      }
    }

    // Hard cap: remove oldest if still over limit
    if (this.seen.size > this.maxEntries) {
      const entries = [...this.seen.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = entries.length - this.maxEntries;
      for (let i = 0; i < toRemove; i++) {
        this.seen.delete(entries[i][0]);
      }
    }
  }
}

// ── Neighbor Table ─────────────────────────────────────────────────────────

export interface Neighbor {
  nodeId: NodeId;
  displayId: string;
  transport: TransportType;
  batteryClass: BatteryClass;
  lastSeen: number;          // unix ms
  rssi?: number;             // BLE signal strength (if available)
  hopCount: number;          // 0 = direct neighbor, >0 = known via bloom filter
  relayCapable: boolean;
  bloomFilter?: Uint8Array;  // their bloom filter of recently-seen NodeIDs
}

/**
 * Tracks directly connected peers and 2-hop visibility.
 */
export class NeighborTable {
  private readonly neighbors: Map<string, Neighbor> = new Map();
  private readonly staleThresholdMs: number;

  constructor(staleThresholdMs = 90_000) { // 3× HELLO interval
    this.staleThresholdMs = staleThresholdMs;
  }

  /**
   * Update or add a neighbor from a received HELLO beacon.
   */
  upsert(
    nodeId: NodeId,
    transport: TransportType,
    batteryClass: BatteryClass,
    relayCapable: boolean,
    bloomFilter?: Uint8Array,
    rssi?: number,
  ): void {
    const key = nodeIdToHex(nodeId);
    this.neighbors.set(key, {
      nodeId,
      displayId: key.substring(0, 8).toUpperCase(),
      transport,
      batteryClass,
      lastSeen: Date.now(),
      rssi,
      hopCount: 0,
      relayCapable,
      bloomFilter,
    });
  }

  /**
   * Remove a neighbor (peer disconnected).
   */
  remove(nodeId: NodeId): void {
    this.neighbors.delete(nodeIdToHex(nodeId));
  }

  /**
   * Get a specific neighbor, or undefined if not known/stale.
   */
  get(nodeId: NodeId): Neighbor | undefined {
    const n = this.neighbors.get(nodeIdToHex(nodeId));
    if (n && this.isStale(n)) {
      this.neighbors.delete(nodeIdToHex(nodeId));
      return undefined;
    }
    return n;
  }

  /**
   * Get all current (non-stale) neighbors.
   */
  getAll(): Neighbor[] {
    this.pruneStale();
    return [...this.neighbors.values()];
  }

  /**
   * Check if a destination NodeId is a direct neighbor.
   */
  isDirectNeighbor(nodeId: NodeId): boolean {
    return this.get(nodeId) !== undefined;
  }

  /**
   * Check if a destination NodeId is visible in any neighbor's bloom filter
   * (2-hop reachability). Returns the neighbor to route through, if found.
   */
  findInBloomFilters(nodeId: NodeId): Neighbor | undefined {
    // Simplified: in production, check actual bloom filter membership
    // For now, this returns undefined (full flooding fallback)
    return undefined;
  }

  /**
   * Get count of current neighbors.
   */
  get size(): number {
    this.pruneStale();
    return this.neighbors.size;
  }

  /**
   * Choose the best neighbor to use as a relay for store-and-forward.
   * Prefers: mains-powered > high battery > relay-capable > low hop count
   */
  bestRelay(): Neighbor | undefined {
    const candidates = this.getAll().filter(n => n.relayCapable);
    if (candidates.length === 0) return undefined;

    const batteryScore = (b: BatteryClass) => {
      switch (b) {
        case BatteryClass.Mains: return 5;
        case BatteryClass.High: return 4;
        case BatteryClass.Normal: return 3;
        case BatteryClass.Low: return 2;
        case BatteryClass.Ephemeral: return 1;
      }
    };

    candidates.sort((a, b) => batteryScore(b.batteryClass) - batteryScore(a.batteryClass));
    return candidates[0];
  }

  private isStale(n: Neighbor): boolean {
    return (Date.now() - n.lastSeen) > this.staleThresholdMs;
  }

  private pruneStale(): void {
    for (const [key, n] of this.neighbors) {
      if (this.isStale(n)) {
        this.neighbors.delete(key);
      }
    }
  }
}

// ── Forwarding Decision ────────────────────────────────────────────────────

export interface ForwardDecision {
  action: 'deliver' | 'forward' | 'drop';
  reason: string;
  targets?: NodeId[];      // specific unicast targets (directed shortcut)
  jitterMs?: number;       // random delay before rebroadcast
}

/**
 * Decide what to do with an incoming packet.
 */
export function makeForwardDecision(
  packet: MeshPacket,
  ownNodeId: NodeId,
  neighbors: NeighborTable,
  dedup: DeduplicationCache,
): ForwardDecision {
  // Dedup
  if (dedup.isDuplicate(packet.packetId)) {
    return { action: 'drop', reason: 'duplicate' };
  }

  // Expired
  const nowS = Math.floor(Date.now() / 1000);
  if ((nowS - packet.timestamp) > 24 * 60 * 60) {
    return { action: 'drop', reason: 'expired' };
  }

  // For us?
  if (bytesEqual(packet.dst, ownNodeId)) {
    return { action: 'deliver', reason: 'addressed to us' };
  }

  // TTL exhausted
  if (packet.ttl <= 0) {
    return { action: 'drop', reason: 'TTL exhausted' };
  }

  // Directed shortcut: if dst is a direct neighbor, unicast
  if (neighbors.isDirectNeighbor(packet.dst)) {
    return {
      action: 'forward',
      reason: 'direct neighbor',
      targets: [packet.dst],
      jitterMs: 0,
    };
  }

  // Check bloom filters for 2-hop directed routing
  const via = neighbors.findInBloomFilters(packet.dst);
  if (via) {
    return {
      action: 'forward',
      reason: `via bloom filter (through ${nodeIdToHex(via.nodeId).substring(0, 8)})`,
      targets: [via.nodeId],
      jitterMs: 0,
    };
  }

  // Default: flood with jitter
  const jitterMs = 50 + Math.floor(Math.random() * 250); // 50-300ms
  return {
    action: 'forward',
    reason: 'flood',
    jitterMs,
  };
}

/**
 * @mesh/relay — Redis-backed Store-and-Forward Queue
 *
 * Implements persistent packet queue management and deduplication using Redis.
 * Replaces the in-memory store-and-forward queue to support server scaling.
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const redis = new Redis(REDIS_URL);

const MAX_QUEUE_BYTES = 5 * 1024 * 1024;   // 5 MB per node
const DEFAULT_TTL_S = 48 * 60 * 60;        // 48 hours (in seconds)
const DEDUP_TTL_S = 10 * 60;               // 10 minutes (in seconds)

export interface RedisStoredPacket {
  packetId: string;
  dataBase64: string;
  storedAt: number;
  expiresAt: number;
  sizeBytes: number;
}

/**
 * Enqueue a packet for a destination NodeID.
 * Returns false if quota exceeded, duplicate, or connection error.
 */
export async function enqueueRedis(
  destNodeId: string,
  packetId: string,
  data: Uint8Array,
  ttlSeconds = DEFAULT_TTL_S
): Promise<boolean> {
  const dedupKey = `dedup:${packetId}`;
  
  // 1. Check duplicate
  const isDup = await redis.get(dedupKey);
  if (isDup) return false;

  const sizeKey = `queue_size:${destNodeId}`;
  const queueKey = `queue:${destNodeId}`;

  // 2. Check current quota
  const currentSizeStr = await redis.get(sizeKey);
  const currentSize = currentSizeStr ? parseInt(currentSizeStr, 10) : 0;
  if (currentSize + data.length > MAX_QUEUE_BYTES) {
    return false; // Quota limit exceeded
  }

  // Convert Uint8Array to base64 for JSON storage
  const base64Data = Buffer.from(data).toString('base64');
  const now = Date.now();
  const packet: RedisStoredPacket = {
    packetId,
    dataBase64: base64Data,
    storedAt: now,
    expiresAt: now + (ttlSeconds * 1000),
    sizeBytes: data.length
  };

  // 3. Multi transaction to push packet, increment size, set TTLs
  const multi = redis.multi();
  
  // Push to list
  multi.rpush(queueKey, JSON.stringify(packet));
  // Increment size counter
  multi.incrby(sizeKey, data.length);
  // Set overall queue TTL
  multi.expire(queueKey, ttlSeconds);
  multi.expire(sizeKey, ttlSeconds);
  // Set dedup key
  multi.setex(dedupKey, DEDUP_TTL_S, '1');

  await multi.exec();
  return true;
}

/**
 * Drain all queued packets for a NodeID (when it connects).
 * Pops all elements and resets size counters.
 */
export async function drainRedis(destNodeId: string): Promise<RedisStoredPacket[]> {
  const queueKey = `queue:${destNodeId}`;
  const sizeKey = `queue_size:${destNodeId}`;

  // Read entire list and delete it atomically
  const multi = redis.multi();
  multi.lrange(queueKey, 0, -1);
  multi.del(queueKey);
  multi.del(sizeKey);

  const results = await multi.exec();
  if (!results || results.length === 0) return [];

  const rawPackets = results[0][1] as string[];
  if (!rawPackets || rawPackets.length === 0) return [];

  const now = Date.now();
  const parsedPackets: RedisStoredPacket[] = rawPackets.map(p => JSON.parse(p));

  // Return only non-expired packets
  return parsedPackets.filter(p => p.expiresAt > now);
}

/**
 * Get the total number of packets queued for a NodeID.
 */
export async function getQueueDepthRedis(destNodeId: string): Promise<number> {
  return redis.llen(`queue:${destNodeId}`);
}

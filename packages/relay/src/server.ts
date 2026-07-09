/**
 * @mesh/relay — Main Server (Convex.dev Production Edition)
 *
 * Fastify + WebSocket relay server utilizing serverless Convex.dev cloud database.
 * - WS /mesh — packet exchange + WebRTC signaling
 * - REST /prekeys/:nodeId — prekey bundle fetch/upload
 * - Rate limiting per NodeID + IP
 * - Packet dedup before forwarding
 */

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import type { WebSocket } from 'ws';
import { SignalingRelay } from './signaling.js';
import { convex, api } from './convexClient.js';

const PORT = parseInt(process.env.RELAY_PORT ?? '4800', 10);
const HOST = process.env.RELAY_HOST ?? '0.0.0.0';

// ── State ──────────────────────────────────────────────────────────────────

/** Connected peers: nodeId (hex) → WebSocket */
const peers = new Map<string, WebSocket>();

const signaling = new SignalingRelay();

/** Rate limiting: nodeId → { count, windowStart } */
const rateLimits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120; // packets per minute per node

/** Dedup for relayed packets */
const relayDedup = new Set<string>();
const DEDUP_MAX = 10_000;

const DEFAULT_TTL_S = 48 * 60 * 60; // 48 hours

// ── Server Setup ───────────────────────────────────────────────────────────

const server = Fastify({ logger: true });

async function start() {
  await server.register(fastifyCors, { origin: true });
  await server.register(fastifyWebsocket);

  // ── Health Check ───────────────────────────────────────────────────────
  server.get('/health', async () => ({
    status: 'ok',
    peers: peers.size,
    uptime: process.uptime(),
    convexUrl: process.env.CONVEX_URL || 'not-configured',
  }));

  // ── Prekey Bundle API ──────────────────────────────────────────────────
  server.get<{ Params: { nodeId: string } }>('/prekeys/:nodeId', async (request, reply) => {
    try {
      const bundle = await convex.query(api.prekeys.get, { nodeId: request.params.nodeId });
      if (!bundle) {
        reply.code(404);
        return { error: 'No prekey bundle found' };
      }
      return bundle;
    } catch (err: any) {
      reply.code(500);
      return { error: `Failed to query prekeys: ${err.message}` };
    }
  });

  server.put<{ Params: { nodeId: string } }>('/prekeys/:nodeId', async (request, reply) => {
    try {
      await convex.mutation(api.prekeys.save, {
        nodeId: request.params.nodeId,
        bundle: JSON.stringify(request.body),
      });
      reply.code(204);
      return;
    } catch (err: any) {
      reply.code(500);
      return { error: `Failed to save prekeys: ${err.message}` };
    }
  });

  // ── WebSocket /mesh ────────────────────────────────────────────────────
  server.get('/mesh', { websocket: true }, (socket, request) => {
    let nodeId: string | null = null;

    socket.on('message', async (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        // ── Auth / Register ──────────────────────────────────────────────
        if (msg.type === 'register') {
          nodeId = msg.nodeId as string;
          if (!nodeId || typeof nodeId !== 'string' || nodeId.length < 8) {
            socket.send(JSON.stringify({ type: 'error', error: 'invalid nodeId' }));
            socket.close();
            return;
          }

          // Register node registration metadata in Convex cloud database
          await convex.mutation(api.registrations.register, {
            nodeId,
            ipAddress: request.ip,
          });

          // Disconnect existing connection for same nodeId
          const existing = peers.get(nodeId);
          if (existing && existing !== socket) {
            existing.close(4001, 'replaced');
          }

          peers.set(nodeId, socket);
          server.log.info({ nodeId, totalPeers: peers.size }, 'peer registered');

          // Drain stored packets from Convex cloud database queue
          const queued = (await convex.mutation(api.packets.drain, {
            destNodeId: nodeId,
          })) as any[];

          for (const pkt of queued) {
            const buf = Buffer.from(pkt.dataBase64, 'base64');
            socket.send(buf);
          }

          socket.send(JSON.stringify({
            type: 'registered',
            nodeId,
            queuedDelivered: queued.length,
            peerCount: peers.size,
          }));
          return;
        }

        // Must be registered for all other operations
        if (!nodeId) {
          socket.send(JSON.stringify({ type: 'error', error: 'not registered' }));
          return;
        }

        // ── Rate limit ───────────────────────────────────────────────────
        if (!checkRateLimit(nodeId)) {
          socket.send(JSON.stringify({ type: 'error', error: 'rate limited' }));
          return;
        }

        // ── Signaling (WebRTC) ───────────────────────────────────────────
        if (msg.type === 'signaling' && msg.signaling) {
          const sigMsg = { ...msg.signaling, from: nodeId };
          if (signaling.validate(sigMsg)) {
            const delivered = signaling.route(sigMsg, peers);
            if (!delivered) {
              socket.send(JSON.stringify({
                type: 'signaling-failed',
                to: sigMsg.to,
                reason: 'peer not connected',
              }));
            }
          }
          return;
        }

        // ── Mesh packet relay ────────────────────────────────────────────
        if (msg.type === 'packet' && msg.destNodeId && msg.data) {
          const packetId = msg.packetId as string;

          // Dedup checking
          if (packetId && relayDedup.has(packetId)) return;
          if (packetId) {
            relayDedup.add(packetId);
            if (relayDedup.size > DEDUP_MAX) {
              const entries = [...relayDedup];
              for (let i = 0; i < entries.length / 2; i++) {
                relayDedup.delete(entries[i]);
              }
            }
          }

          const destSocket = peers.get(msg.destNodeId);
          if (destSocket && destSocket.readyState === 1) {
            // Deliver directly to active socket connection
            destSocket.send(JSON.stringify({
              type: 'packet',
              fromNodeId: nodeId,
              data: msg.data,
            }));
          } else {
            // Store persistently in Convex cloud database queue
            const dataBytes = typeof msg.data === 'string'
              ? new TextEncoder().encode(msg.data)
              : new Uint8Array(msg.data);

            const base64Data = Buffer.from(dataBytes).toString('base64');

            const stored = await convex.mutation(api.packets.enqueue, {
              destNodeId: msg.destNodeId,
              packetId: packetId || crypto.randomUUID(),
              dataBase64: base64Data,
              sizeBytes: dataBytes.length,
              ttlSeconds: DEFAULT_TTL_S,
            });

            if (stored) {
              const queueDepth = (await convex.query(api.packets.getQueueDepth, {
                destNodeId: msg.destNodeId,
              })) as number;

              socket.send(JSON.stringify({
                type: 'stored',
                destNodeId: msg.destNodeId,
                queueDepth,
              }));
            } else {
              socket.send(JSON.stringify({
                type: 'error',
                error: 'failed to store message (quota exceeded)',
              }));
            }
          }
          return;
        }

        // ── Peer list request ────────────────────────────────────────────
        if (msg.type === 'peers') {
          socket.send(JSON.stringify({
            type: 'peers',
            peers: [...peers.keys()].filter(id => id !== nodeId),
            count: peers.size - 1,
          }));
          return;
        }

      } catch (err: any) {
        socket.send(JSON.stringify({ type: 'error', error: `invalid message processing: ${err.message}` }));
      }
    });

    socket.on('close', () => {
      if (nodeId) {
        peers.delete(nodeId);
        server.log.info({ nodeId, totalPeers: peers.size }, 'peer disconnected');
      }
    });

    socket.on('error', (err: any) => {
      server.log.error({ nodeId, err: err.message }, 'websocket error');
    });
  });

  // ── Start ──────────────────────────────────────────────────────────────
  await server.listen({ port: PORT, host: HOST });
  server.log.info(`Mesh relay server (Convex DB Edition) listening on ${HOST}:${PORT}`);
}

// ── Rate Limiting ──────────────────────────────────────────────────────────

function checkRateLimit(nodeId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(nodeId);

  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(nodeId, { count: 1, windowStart: now });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ── Entry ──────────────────────────────────────────────────────────────────

start().catch((err) => {
  console.error('Failed to start relay server:', err);
  process.exit(1);
});

export { server, peers };

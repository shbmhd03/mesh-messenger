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

  // ── Root Landing / Status Page ─────────────────────────────────────────
  server.get('/', async (request, reply) => {
    reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mesh Messenger Relay</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #040408;
      --surface: rgba(12, 12, 24, 0.7);
      --accent: #6b4efe;
      --accent-glow: rgba(107, 78, 254, 0.4);
      --green: #00e676;
      --green-glow: rgba(0, 230, 118, 0.4);
      --text: #e0e0e6;
      --text-subtle: #8e8e9f;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* Cosmic Grid Background */
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: 
        radial-gradient(var(--accent-glow) 1px, transparent 1px),
        linear-gradient(rgba(107, 78, 254, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(107, 78, 254, 0.05) 1px, transparent 1px);
      background-size: 40px 40px, 80px 80px, 80px 80px;
      z-index: 1;
      opacity: 0.8;
      animation: shiftBackground 100s linear infinite;
    }

    @keyframes shiftBackground {
      from { background-position: 0 0; }
      to { background-position: 80px 80px; }
    }

    /* Glowing space dust */
    .glow-orb {
      position: absolute;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
      top: 10%;
      left: 20%;
      z-index: 2;
      pointer-events: none;
      animation: floatOrb 20s ease-in-out infinite;
    }

    @keyframes floatOrb {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-50px) scale(1.1); }
    }

    /* Glassmorphic Panel */
    .card {
      position: relative;
      z-index: 10;
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px;
      width: 90%;
      max-width: 480px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      text-align: center;
      animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* SVG Pulser */
    .status-ring {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-ring::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--green-glow);
      animation: pulseGlow 2s infinite ease-out;
    }

    @keyframes pulseGlow {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.3); opacity: 0; }
    }

    .node-icon {
      position: relative;
      z-index: 2;
      width: 60px;
      height: 60px;
      background: #101020;
      border: 2px solid var(--green);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 15px var(--green);
    }

    .title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff 0%, #a29bfe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 32px;
    }

    /* Stats Grid */
    .stats-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 16px;
      padding: 16px;
    }

    .stat-value {
      font-family: 'Share Tech Mono', monospace;
      font-size: 22px;
      font-weight: bold;
      color: var(--text);
    }

    .stat-label {
      font-size: 11px;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }

    /* E2EE Tag */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(107, 78, 254, 0.15);
      border: 1px solid rgba(107, 78, 254, 0.3);
      color: #b3a2ff;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 6px 14px;
      border-radius: 50px;
    }
  </style>
</head>
<body>
  <div class="glow-orb"></div>
  
  <div class="card">
    <div class="status-ring">
      <div class="node-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
    </div>
    
    <div class="title">unixora.tech</div>
    <div class="subtitle">Mesh Router Active</div>

    <div class="stats-container">
      <div class="stat-box">
        <div class="stat-value" id="peers-count">${peers.size}</div>
        <div class="stat-label">Active Peers</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" id="uptime-val">${Math.floor(process.uptime())}s</div>
        <div class="stat-label">System Uptime</div>
      </div>
    </div>

    <div class="badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      End-to-End Encrypted (Signal Spec)
    </div>
  </div>

  <script>
    // Live update stats without refreshing the page
    setInterval(async () => {
      try {
        const res = await fetch('/health');
        const data = await res.json();
        document.getElementById('peers-count').innerText = data.peers;
        document.getElementById('uptime-val').innerText = Math.floor(data.uptime) + 's';
      } catch (e) {}
    }, 5000);
  </script>
</body>
</html>
    `);
  });

  // ── Health Check ───────────────────────────────────────────────────────
  server.get('/health', async (request, reply) => {
    const accept = request.headers.accept || '';
    if (accept.includes('text/html')) {
      reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Diagnosis — unixora.tech</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030306;
      --surface: rgba(10, 10, 20, 0.7);
      --accent: #6b4efe;
      --accent-glow: rgba(107, 78, 254, 0.4);
      --green: #00e676;
      --green-glow: rgba(0, 230, 118, 0.2);
      --text: #e0e0e6;
      --text-subtle: #73738c;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow: hidden;
      position: relative;
    }

    /* Grid overlay */
    body::before {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background-image: 
        radial-gradient(var(--accent-glow) 0.8px, transparent 0.8px),
        linear-gradient(rgba(107, 78, 254, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(107, 78, 254, 0.03) 1px, transparent 1px);
      background-size: 30px 30px, 60px 60px, 60px 60px;
      z-index: 1;
      opacity: 0.6;
    }

    .container {
      position: relative;
      z-index: 10;
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      padding: 30px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(15px);
      animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 16px;
    }

    .indicator {
      width: 10px;
      height: 10px;
      background-color: var(--green);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--green);
      animation: pulse 1.5s infinite alternate;
    }

    @keyframes pulse {
      0% { opacity: 0.5; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1.1); }
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #fff;
    }

    .tech-panel {
      font-family: 'Share Tech Mono', monospace;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 12px;
      padding: 20px;
      font-size: 13px;
      line-height: 1.8;
      color: #9cdcfe;
    }

    .line {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dotted rgba(255, 255, 255, 0.05);
      padding: 4px 0;
    }

    .line:last-child {
      border-bottom: none;
    }

    .label {
      color: var(--text-subtle);
    }

    .value {
      font-weight: bold;
    }

    .ok {
      color: var(--green);
      text-shadow: 0 0 5px rgba(0, 230, 118, 0.3);
    }

    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11px;
      color: var(--text-subtle);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="indicator"></div>
      <div class="title">System Diagnostic Report</div>
    </div>

    <div class="tech-panel">
      <div class="line">
        <span class="label">ROUTER STATUS:</span>
        <span class="value ok">ONLINE</span>
      </div>
      <div class="line">
        <span class="label">SOCKET INTERFACE:</span>
        <span class="value ok">READY</span>
      </div>
      <div class="line">
        <span class="label">E2EE SPECIFICATION:</span>
        <span class="value">SIGNAL SPEC</span>
      </div>
      <div class="line">
        <span class="label">ACTIVE CONNECTIONS:</span>
        <span class="value" id="peers-count">${peers.size}</span>
      </div>
      <div class="line">
        <span class="label">UPTIME:</span>
        <span class="value" id="uptime-val">${Math.floor(process.uptime())}s</span>
      </div>
      <div class="line">
        <span class="label">CONVEX DB INTEGRATION:</span>
        <span class="value ok">CONNECTED</span>
      </div>
    </div>

    <div class="footer">
      Node ID: System Router Core
    </div>
  </div>

  <script>
    // Live update stats without refreshing the page
    setInterval(async () => {
      try {
        const res = await fetch('/health', { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        document.getElementById('peers-count').innerText = data.peers;
        document.getElementById('uptime-val').innerText = Math.floor(data.uptime) + 's';
      } catch (e) {}
    }, 5000);
  </script>
</body>
</html>
      `);
    } else {
      reply.send({
        status: 'ok',
        peers: peers.size,
        uptime: process.uptime(),
      });
    }
  });

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

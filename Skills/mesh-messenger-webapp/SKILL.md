---
name: "mesh-messenger-webapp"
description: "Use when building or debugging the web client (and relay server) of the mesh messenger: WebRTC DataChannel P2P, WebSocket relay, bridging to the radio mesh, PWA offline/Web Push, encrypted IndexedDB, WASM crypto in Workers, and CSP hardening."
---

# Mesh Messenger — Web App

Web client for the mesh messenger. Implements the protocol from the `mesh-messenger-core` skill — read that first. The browser cannot do BLE mesh or Wi-Fi Direct, so the web app's role is different: a full-featured messenger over **WebRTC P2P + relay**, acting as an internet-side citizen of the mesh that reaches radio-mesh nodes through bridge/relay nodes.

## Honest platform constraints (design around these, don't fight them)

- **Web Bluetooth** (Chromium-only) can act as GATT *central* only, requires a user gesture per device chooser, no advertising, no background. Verdict: useful only as an optional "pair with a nearby phone-node" feature, never as a mesh transport.
- No raw sockets, no UDP, no background execution when the tab closes (service workers get short wakeups via Push only).
- Therefore web transports are: **WebRTC DataChannels** (browser↔browser and browser↔native-app P2P) and **WebSocket to relay servers**. Mobile nodes that run both a radio mesh and a relay/WebRTC connection act as **bridges** between the web world and the BLE mesh.

## Stack

- TypeScript, Vite, React (or Svelte), PWA with service worker.
- One shared `@mesh/core` TypeScript package implementing the exact wire format, routing rules, and crypto of the core skill; compiled protobuf definitions shared with mobile via a single `.proto` source of truth in the monorepo.
- Crypto: `libsignal-client` WASM build preferred; else libsodium.js (`sodium-plus`) — X25519, XChaCha20-Poly1305, Ed25519, HKDF via WebCrypto where native. WebCrypto now has X25519/Ed25519 in modern browsers — use native when available, WASM fallback.
- Never put crypto on the main thread — run the ratchet/session layer in a **Web Worker**; UI talks to it via a typed message bus.

## Transport: WebRTC DataChannels

- Mesh packets (already ciphertext) go through `RTCDataChannel` configured `ordered: false, maxRetransmits: 0` for routing/gossip traffic and a second ordered-reliable channel for message payloads. DataChannels are DTLS-encrypted transport-level; E2EE still comes from the ratchet.
- **Signaling** via the relay server (WebSocket): exchange SDP offers/answers and ICE candidates addressed by NodeID. Include TURN servers (coturn) for NATed peers; measure and expect ~15–20% of pairs to need TURN.
- Fragmentation: respect the core skill's fragment rules anyway (interop with BLE-path peers), but DataChannel chunks up to 16KB are safe — negotiate per-link MTU in HELLO.
- Browser tabs make poor relays (they die). Web nodes advertise battery class = "ephemeral" in HELLO; mesh peers should not select them as custody nodes.

## Transport: relay WebSocket

- Persistent WSS to one or more relay servers; auto-reconnect with jittered backoff; resume with a session token.
- The relay is dumb by design: authenticates NodeID via challenge-signature (Ed25519), stores-and-forwards ciphertext packets, fans out prekey bundles, coordinates WebRTC signaling. It must never hold plaintext or private keys. Consider sealed sender per the core skill.
- Federation-ready: relay address book = list of WSS URLs; packets carry no relay-specific fields.

## Relay server (part of the webapp deliverable)

- Node.js (fastify + ws) or Go. Endpoints: WS `/mesh` (packet exchange + signaling), REST `/prekeys/:nodeId` (bundle fetch/upload), `/push` (Web Push trigger).
- Store-and-forward queue per NodeID (Redis/Postgres), quota + TTL per the core skill custody rules.
- Rate limiting per NodeID and IP; packet_id dedup; drop malformed frames before parsing (fuzz this parser too).

## Persistence & offline (PWA)

- **IndexedDB** via a thin wrapper (Dexie): same logical schema as mobile (contacts, sessions, messages, outbox, prekeys). Encrypt values at rest: envelope-encrypt records with an AES-GCM master key held as a **non-extractable CryptoKey** in IndexedDB — this is the best browser-available approximation of a keystore; document the weaker threat model vs mobile (XSS = game over, so CSP is critical).
- Strict CSP (`default-src 'self'`, no inline scripts), Trusted Types, dependency audit in CI — XSS is the whole ballgame for a web E2EE client.
- Service worker: precache app shell (Workbox), queue outbound messages written to outbox while offline, flush on `online`/next open.
- **Web Push** for background delivery: relay sends push (payload = ciphertext or just a wake signal), service worker decrypts via the worker-shared session code and shows a notification. Requires VAPID; Safari supports Web Push for installed PWAs (16.4+).
- Multi-tab safety: single-writer via `navigator.locks` — one tab owns the transports; others proxy through `BroadcastChannel`.

## UI essentials

- Follow the `frontend-design` skill for visual direction — this should not look like a bootstrap template. Dark-first, information-dense chat UI.
- Conversation list, chat view with delivery states (pending/sent/delivered/read), safety-number verification (QR display + camera scan via `BarcodeDetector`/ZXing), network status panel showing: relay connection, WebRTC peer count, and — the differentiator — the **bridged mesh view**: which mobile bridge nodes are reachable and how many radio-mesh hops lie behind them.
- Attachment support: encrypt file with a random key (per-file), upload ciphertext blob to relay object storage, send key+hash in the E2EE message; P2P DataChannel file transfer when a direct link exists.
- Virtualized message list (`@tanstack/virtual`) — mesh debug views and long chats will hit thousands of rows.

## Interop discipline

- The web client MUST pass the same golden test vectors as Android/iOS (see core skill): packet encode/decode, X3DH, ratchet round-trips. Put these in CI on every commit.
- Integration test rig: headless Chrome (Playwright) node ↔ relay ↔ second headless node; then Playwright node ↔ relay ↔ physical Android bridging to an offline iPhone — the full three-platform smoke test.

## Pitfalls checklist

- Don't attempt Web Bluetooth mesh — it can't advertise. Crypto in a Worker, never the main thread. Non-extractable keys + strict CSP or your E2EE is theater. `navigator.locks` for multi-tab. TURN or ~1/5 of P2P pairs fail. Ephemeral battery class in HELLO. Safari: test Web Push installed-PWA path and IndexedDB eviction (request `navigator.storage.persist()`).

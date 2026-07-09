---
name: "mesh-messenger-core"
description: "Use when designing or implementing the platform-agnostic core of the mesh messenger: wire protocol, mesh routing, store-and-forward, identity, and end-to-end encryption (X3DH, double ratchet, groups). Load before any protocol/crypto work on Android, iOS, or web."
---

# Mesh Messenger — Core Protocol, Routing & E2EE

This skill defines the shared, platform-agnostic design for an advanced mesh messenger. The Android, iOS, and web clients must all implement THIS protocol so they interoperate. Read this before writing any transport or crypto code on any platform.

## Architecture: layered design

Keep four strictly separated layers. Never let crypto code touch transport code directly.

1. **Transport layer** — moves opaque byte frames between directly connected peers (BLE, Wi-Fi Direct, WebRTC, internet relay). Pluggable: each platform registers the transports it supports behind a common interface: `send(peerId, bytes)`, `onReceive(peerId, bytes)`, `onPeerFound/Lost`.
2. **Mesh/routing layer** — node identity, neighbor table, packet forwarding, TTL, deduplication, store-and-forward queues.
3. **Session/crypto layer** — X3DH handshakes, double-ratchet sessions, group sender keys. Consumes and produces ciphertext only.
4. **Application layer** — messages, receipts, typing indicators, attachments, profile sync, backed by a local encrypted store.

## Identity

- Every device generates a long-term **Ed25519 identity keypair** on first launch. NodeID = first 16 bytes of SHA-256(public key). Never transmit the private key; store it in the platform keystore (Android Keystore / iOS Keychain / non-extractable WebCrypto key).
- Derive an X25519 keypair for encryption (or keep a separate one; do not reuse the signing key bits directly without a proper conversion, prefer separate keys).
- Human verification: render a **safety number** (fingerprint of both parties' identity keys) and a QR code for in-person verification. Show a warning banner when a contact's identity key changes.
- Support multiple devices per user later by treating each device as a distinct node; user identity = set of device keys signed by a user-level key.

## Wire format

Use a compact binary format (protobuf or hand-rolled TLV; protobuf recommended for cross-platform codegen). Every mesh packet:

```
MeshPacket {
  version: u8
  type: u8            // 0=data, 1=ack, 2=hello, 3=route_probe, 4=prekey_request, 5=prekey_bundle, 6=fragment
  packet_id: 8 bytes  // random; used for dedup
  src: 16 bytes       // NodeID (omit/zero for anonymous flood mode)
  dst: 16 bytes       // NodeID or broadcast (all 0xFF)
  ttl: u8             // start 6–8; decrement per hop; drop at 0
  hop_count: u8
  timestamp: u32      // unix seconds, for expiry
  payload: bytes      // ciphertext — routing nodes MUST NOT be able to read it
  signature: optional // sign header for anti-tamper where needed
}
```

Rules:
- **MTU discipline**: BLE effective MTU can be as low as ~180 bytes after overhead. Fragment at the mesh layer: `fragment` packets carry (msg_id, index, total). Reassemble with a 60s timeout. Target fragment payload ≤ 160 bytes for BLE paths; larger transports send whole packets.
- **Dedup cache**: LRU set of packet_ids seen in the last ~10 minutes (cap ~5,000 entries). Drop duplicates silently before any other processing.
- **Expiry**: drop packets older than 24h (configurable per message priority).

## Routing: gossip + smart flooding, not full DSR

For meshes under ~100 nodes, controlled flooding beats maintaining routing tables under churn:

- **HELLO beacons** every 15–30s to direct neighbors carrying NodeID, battery class, transport capabilities, and a bloom filter of recently-seen NodeIDs (this gives cheap 2-hop visibility).
- **Forwarding**: on receiving a data packet not addressed to you: if dedup-new and TTL > 0, decrement TTL, re-broadcast to all neighbors except the arrival link. Add per-node random jitter (50–300ms) before rebroadcast to avoid collision storms.
- **Directed shortcut**: if the destination appears in your neighbor table or a neighbor's bloom filter, unicast to that neighbor instead of flooding.
- **Backpressure**: cap forwarding budget per peer (e.g., 32 packets/min for battery-saver nodes); advertise your class in HELLO so senders can prefer mains-powered/high-battery relays.
- **Internet relay bridging**: a node with internet connectivity advertises `RELAY` capability. It bridges packets to a relay server (or federated relays) over TLS/WebSocket, letting two disconnected mesh islands communicate. The relay only ever sees ciphertext + routing headers; consider sealed-sender (encrypt src field to destination) for metadata protection.

## Store-and-forward

- Every node keeps an **outbox queue** per destination in the encrypted local DB: status = pending → in-flight → acked. Retry with exponential backoff (1min, 4min, 16min... cap 1h) whenever any route to the destination appears.
- **Custody transfer** (advanced): willing relay nodes may accept encrypted messages for offline destinations, holding up to a quota (e.g., 5MB, 48h TTL). The origin gets a custody-ack and can stop retrying; the custodian delivers when it meets the destination. Payloads are E2E encrypted so custody is safe.
- End-to-end **ACKs** are themselves mesh packets (type=ack, references packet_id) — delivery receipts come only from the true destination decrypting successfully, never from relays.

## End-to-end encryption

Implement the Signal-style stack. Use libsignal bindings where available (Android/iOS: libsignal-client; web: libsignal-client WASM) rather than hand-rolling; if hand-rolling for learning, use libsodium primitives only.

**Session establishment — X3DH adapted for offline mesh:**
- Each node pre-publishes a **prekey bundle** (identity key, signed prekey, batch of one-time prekeys). In a mesh without a server, bundles are (a) exchanged directly during any live encounter and cached, (b) requestable over the mesh (`prekey_request`/`prekey_bundle` packets), and (c) mirrored by relay servers when online.
- First message to a new contact: run X3DH against their cached bundle → initial root key → start double ratchet. If no bundle is available, queue the message and emit a `prekey_request`.

**Double ratchet:**
- DH ratchet on X25519, symmetric-key ratchet with HKDF-SHA256, message keys for AES-256-GCM or XChaCha20-Poly1305.
- Mesh reality: heavy out-of-order delivery. Keep **skipped message keys** (cap ~1,000 per session, with expiry) so late-arriving fragments still decrypt.
- Header encryption: encrypt ratchet headers so relays can't track ratchet state.

**Groups:**
- Use **sender keys**: each member generates a sender key (chain key + signature key), distributes it pairwise via existing 1:1 ratchet sessions. Group messages: one encryption, one mesh broadcast — critical for mesh bandwidth.
- Rekey (new sender keys all around) on member removal. For large/long-lived groups consider MLS, but sender keys are the right default for mesh.

**Rules:**
- Zero plaintext ever leaves the app layer. Routing metadata is the only cleartext.
- Random nonces from the platform CSPRNG; never counter-based nonces across restarts.
- Constant-time comparisons for MACs/fingerprints.
- Local DB encrypted with SQLCipher (mobile) / encrypted IndexedDB envelope (web), key held in platform keystore.

## Local store schema (all platforms)

Tables: `contacts` (node_id, identity_key, verified flag), `sessions` (serialized ratchet state, BLOB), `messages` (id, convo_id, direction, status: pending/sent/delivered/read/failed, timestamp, ciphertext-at-rest), `outbox`, `custody`, `prekeys`, `neighbors` (ephemeral, can be in-memory).

## Anti-abuse & hardening

- Rate-limit per-neighbor inbound packets; score and temporarily ban flooding peers.
- Validate every field before parsing payloads; fuzz the packet parser in CI.
- Replay protection via dedup cache + per-session ratchet ordering.
- Don't log NodeIDs or message metadata at info level in release builds.

## Testing the core

- Build the mesh/crypto core as a pure library with **no platform imports**, tested with a simulated network harness: N virtual nodes, configurable topology, packet loss %, latency, churn. Assert delivery rates, dedup correctness, and ratchet recovery under 30% loss and out-of-order delivery.
- Golden-file interop tests: fixed test vectors (keys, packets, ciphertexts) checked into the repo; Android, iOS, and web implementations must all pass the same vectors.

## Related skills

Use `mesh-messenger-android`, `mesh-messenger-ios`, and `mesh-messenger-webapp` for platform transports and UI. This skill is the source of truth whenever they conflict on protocol matters.

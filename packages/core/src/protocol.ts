/**
 * @mesh/core — Wire Protocol
 *
 * Defines the MeshPacket binary format matching the core skill spec exactly.
 * Manual TLV encoding for now; protobuf migration planned.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export enum PacketType {
  Data = 0,
  Ack = 1,
  Hello = 2,
  RouteProbe = 3,
  PrekeyRequest = 4,
  PrekeyBundle = 5,
  Fragment = 6,
}

export enum TransportType {
  BLE = 'ble',
  WiFiDirect = 'wifi-direct',
  WiFiAware = 'wifi-aware',
  MultipeerConnectivity = 'mpc',
  WebRTC = 'webrtc',
  Relay = 'relay',
}

export enum BatteryClass {
  Mains = 'mains',
  High = 'high',
  Normal = 'normal',
  Low = 'low',
  Ephemeral = 'ephemeral', // web tabs — never use as custody nodes
}

export enum MessageStatus {
  Pending = 'pending',
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Failed = 'failed',
}

// ── Types ──────────────────────────────────────────────────────────────────

/** 16-byte Node ID = first 16 bytes of SHA-256(Ed25519 public key) */
export type NodeId = Uint8Array;

/** 8-byte random packet identifier for dedup */
export type PacketId = Uint8Array;

/** Broadcast address — all 0xFF */
export const BROADCAST_DST = new Uint8Array(16).fill(0xFF);

/** Current wire protocol version */
export const PROTOCOL_VERSION = 1;

/** Default TTL for new packets */
export const DEFAULT_TTL = 7;

/** Maximum packet age before expiry (seconds) */
export const MAX_PACKET_AGE_S = 24 * 60 * 60; // 24 hours

/** BLE-safe fragment payload size */
export const BLE_FRAGMENT_SIZE = 160;

// ── MeshPacket ─────────────────────────────────────────────────────────────

export interface MeshPacket {
  version: number;        // u8
  type: PacketType;       // u8
  packetId: PacketId;     // 8 bytes, random
  src: NodeId;            // 16 bytes (zero for anonymous flood)
  dst: NodeId;            // 16 bytes (BROADCAST_DST for broadcast)
  ttl: number;            // u8, start 6-8, decrement per hop
  hopCount: number;       // u8
  timestamp: number;      // u32, unix seconds
  payload: Uint8Array;    // ciphertext — routing nodes MUST NOT read
  signature?: Uint8Array; // optional, sign header for anti-tamper
}

/** Fragment header for reassembly */
export interface FragmentHeader {
  messageId: PacketId;  // 8 bytes — groups fragments
  index: number;        // u8, 0-based fragment index
  total: number;        // u8, total fragments
}

/** HELLO beacon payload */
export interface HelloPayload {
  nodeId: NodeId;
  batteryClass: BatteryClass;
  transports: TransportType[];
  bloomFilter: Uint8Array;  // Bloom filter of recently-seen NodeIDs (2-hop visibility)
  relayCapable: boolean;
}

// ── Fixed header layout ────────────────────────────────────────────────────
//
//  Offset  Size  Field
//  0       1     version
//  1       1     type
//  2       8     packetId
//  10      16    src
//  26      16    dst
//  42      1     ttl
//  43      1     hopCount
//  44      4     timestamp
//  48      2     payloadLength (u16 big-endian)
//  50      N     payload
//  50+N    ...   signature (optional, rest of packet)
//
const HEADER_SIZE = 50;

// ── Encoding ───────────────────────────────────────────────────────────────

/**
 * Encode a MeshPacket into a binary frame.
 */
export function encodePacket(packet: MeshPacket): Uint8Array {
  const payloadLen = packet.payload.length;
  const sigLen = packet.signature?.length ?? 0;
  const totalLen = HEADER_SIZE + payloadLen + sigLen;

  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  buf[0] = packet.version;
  buf[1] = packet.type;
  buf.set(packet.packetId.slice(0, 8), 2);
  buf.set(packet.src.slice(0, 16), 10);
  buf.set(packet.dst.slice(0, 16), 26);
  buf[42] = packet.ttl;
  buf[43] = packet.hopCount;
  view.setUint32(44, packet.timestamp, false); // big-endian
  view.setUint16(48, payloadLen, false);       // big-endian
  buf.set(packet.payload, HEADER_SIZE);

  if (packet.signature && sigLen > 0) {
    buf.set(packet.signature, HEADER_SIZE + payloadLen);
  }

  return buf;
}

/**
 * Decode a binary frame into a MeshPacket.
 * Throws on malformed input.
 */
export function decodePacket(data: Uint8Array): MeshPacket {
  if (data.length < HEADER_SIZE) {
    throw new Error(`Packet too short: ${data.length} < ${HEADER_SIZE}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const version = data[0];
  const type = data[1] as PacketType;
  const packetId = data.slice(2, 10);
  const src = data.slice(10, 26);
  const dst = data.slice(26, 42);
  const ttl = data[42];
  const hopCount = data[43];
  const timestamp = view.getUint32(44, false);
  const payloadLength = view.getUint16(48, false);

  if (data.length < HEADER_SIZE + payloadLength) {
    throw new Error(`Payload truncated: expected ${payloadLength} bytes, got ${data.length - HEADER_SIZE}`);
  }

  const payload = data.slice(HEADER_SIZE, HEADER_SIZE + payloadLength);

  let signature: Uint8Array | undefined;
  const sigStart = HEADER_SIZE + payloadLength;
  if (data.length > sigStart) {
    signature = data.slice(sigStart);
  }

  return { version, type, packetId, src, dst, ttl, hopCount, timestamp, payload, signature };
}

/**
 * Generate a random 8-byte packet ID using CSPRNG.
 */
export function generatePacketId(): PacketId {
  const id = new Uint8Array(8);
  crypto.getRandomValues(id);
  return id;
}

/**
 * Check if a packet has expired based on current time.
 */
export function isPacketExpired(packet: MeshPacket, maxAgeSeconds = MAX_PACKET_AGE_S): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (now - packet.timestamp) > maxAgeSeconds;
}

/**
 * Compare two NodeIds or PacketIds for equality (constant-time for security-sensitive use).
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Convert a NodeId to a hex string for display.
 */
export function nodeIdToHex(id: NodeId): string {
  return Array.from(id).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert a hex string back to a NodeId.
 */
export function hexToNodeId(hex: string): NodeId {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Get a short display name from a NodeId (first 4 bytes as hex).
 */
export function shortNodeId(id: NodeId): string {
  return nodeIdToHex(id).substring(0, 8);
}

/**
 * Check if a destination is the broadcast address.
 */
export function isBroadcast(dst: NodeId): boolean {
  return bytesEqual(dst, BROADCAST_DST);
}

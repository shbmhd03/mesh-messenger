/**
 * @mesh/core — Identity
 *
 * Node identity management: Ed25519 signing keys, X25519 encryption keys,
 * NodeID derivation, and safety number computation.
 */

import { type NodeId, nodeIdToHex } from './protocol.js';

// ── Key Types ──────────────────────────────────────────────────────────────

export interface IdentityKeyPair {
  publicKey: Uint8Array;  // Ed25519 public key (32 bytes)
  privateKey: Uint8Array; // Ed25519 private key (64 bytes)
}

export interface EncryptionKeyPair {
  publicKey: Uint8Array;  // X25519 public key (32 bytes)
  privateKey: Uint8Array; // X25519 private key (32 bytes)
}

export interface PreKeyBundle {
  identityKey: Uint8Array;        // Ed25519 public
  signedPreKey: Uint8Array;       // X25519 public, signed
  signedPreKeySignature: Uint8Array;
  oneTimePreKeys: Uint8Array[];   // batch of X25519 public keys
}

export interface LocalIdentity {
  nodeId: NodeId;
  identityKeyPair: IdentityKeyPair;
  encryptionKeyPair: EncryptionKeyPair;
  createdAt: number;  // unix ms
}

// ── NodeID derivation ──────────────────────────────────────────────────────

/**
 * Derive NodeID from an Ed25519 public key.
 * NodeID = first 16 bytes of SHA-256(publicKey)
 */
export async function deriveNodeId(publicKey: Uint8Array): Promise<NodeId> {
  const hash = await crypto.subtle.digest('SHA-256', publicKey as any);
  return new Uint8Array(hash).slice(0, 16);
}

// ── Safety Numbers ─────────────────────────────────────────────────────────

/**
 * Compute a safety number (fingerprint) from two identity public keys.
 * Used for human verification of E2EE sessions.
 *
 * Returns a numeric string of 60 digits (12 groups of 5).
 * Both parties compute the same number regardless of order.
 */
export async function computeSafetyNumber(
  key1: Uint8Array,
  key2: Uint8Array,
): Promise<string> {
  // Order keys deterministically (lexicographic)
  const [first, second] = compareBytes(key1, key2) < 0
    ? [key1, key2]
    : [key2, key1];

  // Concatenate and hash
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);

  // Iterative hashing (5200 rounds like Signal)
  let hash = combined;
  for (let i = 0; i < 5200; i++) {
    hash = new Uint8Array(await crypto.subtle.digest('SHA-256', hash as any));
  }

  // Convert to 60-digit numeric string
  const digits: string[] = [];
  for (let i = 0; i < 30; i++) {
    // Take 2 bytes, mod 100000 for 5-digit groups
    const val = (hash[i % hash.length] << 8 | hash[(i + 1) % hash.length]) % 100000;
    if (i % 5 === 0 && i > 0) digits.push(' ');
    digits.push(val.toString().padStart(5, '0'));
  }

  return digits.join('').trim();
}

/**
 * Format a safety number for display (groups of 5 digits, 5 per line).
 */
export function formatSafetyNumber(safetyNumber: string): string {
  const groups = safetyNumber.replace(/\s/g, '').match(/.{1,5}/g) ?? [];
  const lines: string[] = [];
  for (let i = 0; i < groups.length; i += 5) {
    lines.push(groups.slice(i, i + 5).join(' '));
  }
  return lines.join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Lexicographic comparison of byte arrays.
 */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Generate a placeholder identity for demo/testing.
 * In production, use WebCrypto Ed25519/X25519 key generation.
 */
export async function generateDemoIdentity(): Promise<LocalIdentity> {
  // Generate random keys for demo (real impl uses Ed25519/X25519)
  const fakeSigningPub = new Uint8Array(32);
  crypto.getRandomValues(fakeSigningPub);

  const fakeSigningPriv = new Uint8Array(64);
  crypto.getRandomValues(fakeSigningPriv);

  const fakeEncPub = new Uint8Array(32);
  crypto.getRandomValues(fakeEncPub);

  const fakeEncPriv = new Uint8Array(32);
  crypto.getRandomValues(fakeEncPriv);

  const nodeId = await deriveNodeId(fakeSigningPub);

  return {
    nodeId,
    identityKeyPair: { publicKey: fakeSigningPub, privateKey: fakeSigningPriv },
    encryptionKeyPair: { publicKey: fakeEncPub, privateKey: fakeEncPriv },
    createdAt: Date.now(),
  };
}

/**
 * Display-friendly node identifier: first 8 hex chars.
 */
export function displayNodeId(id: NodeId): string {
  return nodeIdToHex(id).substring(0, 8).toUpperCase();
}

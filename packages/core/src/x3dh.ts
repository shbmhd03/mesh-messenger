/**
 * @mesh/core — X3DH (Extended Triple Diffie-Hellman)
 *
 * Implements offline E2EE session setup matching the Signal protocol.
 * Derives initial shared master keys between Alice and Bob.
 */

import { hkdfDerive, computeDHSharedSecret, generateDHKeyPair, type DHKeyPair } from './crypto.js';

export interface PreKeyBundle {
  identityKey: Uint8Array;       // Bob's Identity Key (IK_B)
  signedPreKey: Uint8Array;      // Bob's Signed Prekey (SPK_B)
  oneTimePreKey: Uint8Array | null; // Bob's One-Time Prekey (OPK_B)
}

export interface X3DHResult {
  sharedMasterKey: Uint8Array;
  ephemeralPublicKey: Uint8Array; // EK_A to send to Bob
}

/**
 * Initiator (Alice) performs the X3DH handshake.
 * Bob's keys are obtained from a prekey bundle cached locally or from the relay.
 */
export async function initiateX3DH(
  aliceIdentityKey: CryptoKey,
  bobBundle: PreKeyBundle
): Promise<X3DHResult> {
  // 1. Generate Alice Ephemeral Keypair (EK_A)
  const aliceEphemeral = await generateDHKeyPair();

  // 2. Compute Diffie-Hellman outputs
  // DH1 = DH(IK_A, SPK_B)
  const dh1 = await computeDHSharedSecret(aliceIdentityKey, bobBundle.signedPreKey);

  // DH2 = DH(EK_A, IK_B)
  const dh2 = await computeDHSharedSecret(aliceEphemeral.privateKey, bobBundle.identityKey);

  // DH3 = DH(EK_A, SPK_B)
  const dh3 = await computeDHSharedSecret(aliceEphemeral.privateKey, bobBundle.signedPreKey);

  // DH4 = DH(EK_A, OPK_B) — if one-time prekey present in Bob's bundle
  let dh4 = new Uint8Array(0);
  if (bobBundle.oneTimePreKey) {
    dh4 = await computeDHSharedSecret(aliceEphemeral.privateKey, bobBundle.oneTimePreKey) as any;
  }

  // 3. Concatenate DH outputs
  const masterSecret = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4.length);
  masterSecret.set(dh1, 0);
  masterSecret.set(dh2, dh1.length);
  masterSecret.set(dh3, dh1.length + dh2.length);
  if (dh4.length > 0) {
    masterSecret.set(dh4, dh1.length + dh2.length + dh3.length);
  }

  // 4. Derive initial shared master key using HKDF
  const salt = new Uint8Array(32); // zero-filled salt
  const info = new TextEncoder().encode('MeshX3DHMasterKey');
  const sharedMasterKey = await hkdfDerive(salt, masterSecret, info, 32);

  return {
    sharedMasterKey,
    ephemeralPublicKey: aliceEphemeral.publicKey
  };
}

/**
 * Receiver (Bob) handles incoming X3DH handshake.
 * Alice sends her Identity Key (IK_A) and Ephemeral Key (EK_A).
 */
export async function receiveX3DH(
  bobIdentityKey: CryptoKey,
  bobSignedPreKey: CryptoKey,
  bobOneTimePreKey: CryptoKey | null,
  aliceIdentityKeyRaw: Uint8Array,
  aliceEphemeralKeyRaw: Uint8Array
): Promise<Uint8Array> {
  // Compute DH outputs
  // DH1 = DH(SPK_B, IK_A)
  const dh1 = await computeDHSharedSecret(bobSignedPreKey, aliceIdentityKeyRaw);

  // DH2 = DH(IK_B, EK_A)
  const dh2 = await computeDHSharedSecret(bobIdentityKey, aliceEphemeralKeyRaw);

  // DH3 = DH(SPK_B, EK_A)
  const dh3 = await computeDHSharedSecret(bobSignedPreKey, aliceEphemeralKeyRaw);

  // DH4 = DH(OPK_B, EK_A) — if Alice used Bob's one-time prekey
  let dh4 = new Uint8Array(0);
  if (bobOneTimePreKey) {
    dh4 = await computeDHSharedSecret(bobOneTimePreKey, aliceEphemeralKeyRaw) as any;
  }

  // Concatenate DH outputs
  const masterSecret = new Uint8Array(dh1.length + dh2.length + dh3.length + dh4.length);
  masterSecret.set(dh1, 0);
  masterSecret.set(dh2, dh1.length);
  masterSecret.set(dh3, dh1.length + dh2.length);
  if (dh4.length > 0) {
    masterSecret.set(dh4, dh1.length + dh2.length + dh3.length);
  }

  // Derive initial shared master key
  const salt = new Uint8Array(32);
  const info = new TextEncoder().encode('MeshX3DHMasterKey');
  return hkdfDerive(salt, masterSecret, info, 32);
}

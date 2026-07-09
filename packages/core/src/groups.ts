/**
 * @mesh/core — Group Sender Keys
 *
 * Implements Signal-style Group Sender Keys for bandwidth-efficient E2EE broadcasts.
 * One encryption + one mesh broadcast per message.
 */

import { hkdfDerive, encryptAESGCM, decryptAESGCM } from './crypto.js';

export interface SenderKeyChain {
  chainKey: Uint8Array;
  messageNumber: number;
}

export interface GroupSessionState {
  groupId: string;
  senderKeys: Map<string, SenderKeyChain>; // hex(peerNodeId) -> current chain key
  ownChainKey: Uint8Array;
  ownMessageNumber: number;
}

/**
 * Generate a new random local sender key.
 * This is distributed to group members via 1:1 ratchet sessions.
 */
export function generateSenderKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

/**
 * Roll a group chain key forward using HKDF to get next chain key and message key.
 */
async function rollGroupKey(chainKey: Uint8Array): Promise<{ nextChainKey: Uint8Array; messageKey: Uint8Array }> {
  const derived = await hkdfDerive(
    chainKey,
    new Uint8Array([0x03]),
    new TextEncoder().encode('MeshGroupMessageKey'),
    32
  );
  
  const nextChainKey = await hkdfDerive(
    chainKey,
    new Uint8Array([0x04]),
    new TextEncoder().encode('MeshGroupChainKey'),
    32
  );

  return {
    nextChainKey,
    messageKey: derived
  };
}

/**
 * Encrypt a broadcast message for the group.
 * Derives a message key from own chain key and rolls own chain key forward.
 */
export async function encryptGroupMessage(
  state: GroupSessionState,
  plaintext: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; nextState: GroupSessionState }> {
  const { nextChainKey, messageKey } = await rollGroupKey(state.ownChainKey);
  
  // Encrypt
  const assocData = new TextEncoder().encode(state.groupId);
  const { ciphertext, iv } = await encryptAESGCM(messageKey, plaintext, assocData);

  const nextState: GroupSessionState = {
    ...state,
    ownChainKey: nextChainKey,
    ownMessageNumber: state.ownMessageNumber + 1
  };

  return {
    ciphertext,
    iv,
    nextState
  };
}

/**
 * Decrypt an incoming group message from a peer.
 * Retrieves the peer's sender key chain, rolls it forward, and decrypts.
 */
export async function decryptGroupMessage(
  state: GroupSessionState,
  senderNodeIdHex: string,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<{ plaintext: Uint8Array; nextState: GroupSessionState }> {
  const peerChain = state.senderKeys.get(senderNodeIdHex);
  if (!peerChain) {
    throw new Error(`No sender key for peer: ${senderNodeIdHex}`);
  }

  const { nextChainKey, messageKey } = await rollGroupKey(peerChain.chainKey);
  
  // Decrypt
  const assocData = new TextEncoder().encode(state.groupId);
  const plaintext = await decryptAESGCM(messageKey, iv, ciphertext, assocData);

  // Update peer chain key in state
  const updatedSenderKeys = new Map(state.senderKeys);
  updatedSenderKeys.set(senderNodeIdHex, {
    chainKey: nextChainKey,
    messageNumber: peerChain.messageNumber + 1
  });

  const nextState: GroupSessionState = {
    ...state,
    senderKeys: updatedSenderKeys
  };

  return {
    plaintext,
    nextState
  };
}

/**
 * @mesh/core — Double Ratchet
 *
 * Implements the Signal-style Double Ratchet state machine.
 * Features skipped-message key tracking for out-of-order delivery.
 */

import { hkdfDerive, computeDHSharedSecret, generateDHKeyPair, type DHKeyPair } from './crypto.js';
import { bytesEqual, nodeIdToHex } from './protocol.js';

const SKIPPED_KEY_MAX = 1000;

export interface KDFChainKeys {
  chainKey: Uint8Array;
  messageKey: Uint8Array;
}

export interface RatchetState {
  dhsLocal: DHKeyPair;
  dhsRemote: Uint8Array | null;
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array | null;
  receivingChainKey: Uint8Array | null;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  previousSendingMessageNumber: number;
  skippedMessageKeys: Map<string, Uint8Array>; // "remoteEphemHex:msgNum" -> key
}

// ── KDF Derivation Helper Functions ────────────────────────────────────────

/**
 * Derive new Root Key and Chain Key from Root Key and DH output.
 */
async function kdfRoot(rootKey: Uint8Array, dhOutput: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const derived = await hkdfDerive(
    rootKey,
    dhOutput,
    new TextEncoder().encode('MeshRatchetRoot'),
    64
  );
  return [derived.slice(0, 32), derived.slice(32, 64)];
}

/**
 * Roll a Chain Key forward to get next Chain Key and Message Key.
 */
async function kdfChain(chainKey: Uint8Array): Promise<KDFChainKeys> {
  const derived = await hkdfDerive(
    chainKey,
    new Uint8Array([0x01]),
    new TextEncoder().encode('MeshRatchetMessage'),
    32
  );
  
  const nextChainKey = await hkdfDerive(
    chainKey,
    new Uint8Array([0x02]),
    new TextEncoder().encode('MeshRatchetChain'),
    32
  );
  
  return {
    chainKey: nextChainKey,
    messageKey: derived
  };
}

// ── Session Operations ─────────────────────────────────────────────────────

/**
 * Initialize a new Double Ratchet session.
 * For the initiator (sending first message):
 *   - Runs X3DH to get shared master key -> rootKey.
 *   - Local ephemeral key is dhsLocal.
 *   - Remote identity key is dhsRemote.
 */
export async function initializeSession(
  masterKey: Uint8Array,
  remotePublicKey: Uint8Array
): Promise<RatchetState> {
  const localDH = await generateDHKeyPair();
  
  // Initiator performs first root derivation using masterKey and first DH output
  const dhOutput = await computeDHSharedSecret(localDH.privateKey, remotePublicKey);
  const [rootKey, sendingChainKey] = await kdfRoot(masterKey, dhOutput);

  return {
    dhsLocal: localDH,
    dhsRemote: remotePublicKey,
    rootKey,
    sendingChainKey,
    receivingChainKey: null,
    sendingMessageNumber: 0,
    receivingMessageNumber: 0,
    previousSendingMessageNumber: 0,
    skippedMessageKeys: new Map()
  };
}

/**
 * Perform a symmetric KDF step on the sending chain to get next message key.
 */
export async function getSendingMessageKey(state: RatchetState): Promise<{ key: Uint8Array; state: RatchetState }> {
  if (!state.sendingChainKey) {
    throw new Error('Sending chain not initialized');
  }

  const { chainKey, messageKey } = await kdfChain(state.sendingChainKey);

  const updatedState: RatchetState = {
    ...state,
    sendingChainKey: chainKey,
    sendingMessageNumber: state.sendingMessageNumber + 1
  };

  return {
    key: messageKey,
    state: updatedState
  };
}

/**
 * Try to decrypt or retrieve skipped keys.
 * If message key was skipped previously, returns it and deletes it from storage.
 */
export function getSkippedMessageKey(state: RatchetState, remoteEphemeral: Uint8Array, msgNum: number): Uint8Array | null {
  const key = `${nodeIdToHex(remoteEphemeral)}:${msgNum}`;
  const mKey = state.skippedMessageKeys.get(key);
  if (mKey) {
    state.skippedMessageKeys.delete(key);
    return mKey;
  }
  return null;
}

/**
 * Process receiving a message with potentially new ephemeral keys and packet numbers.
 */
export async function getReceivingMessageKey(
  state: RatchetState,
  remoteEphemeral: Uint8Array,
  msgNum: number
): Promise<{ key: Uint8Array; state: RatchetState }> {
  let updatedState = { ...state };
  
  // Did we get a new DH public key from the remote side?
  const isNewDH = !state.dhsRemote || !bytesEqual(state.dhsRemote, remoteEphemeral);

  if (isNewDH) {
    // 1. Skip keys from previous DH chain
    if (state.dhsRemote) {
      updatedState = await skipMessageKeys(updatedState, state.previousSendingMessageNumber);
    }
    
    // 2. Perform DH Ratchet step
    const dhOutput = await computeDHSharedSecret(updatedState.dhsLocal.privateKey, remoteEphemeral);
    const [rootKey, receivingChainKey] = await kdfRoot(updatedState.rootKey, dhOutput);
    
    // 3. Roll our own DH key for the next sending cycle
    const nextLocalDH = await generateDHKeyPair();
    const nextDhOutput = await computeDHSharedSecret(nextLocalDH.privateKey, remoteEphemeral);
    const [nextRootKey, sendingChainKey] = await kdfRoot(rootKey, nextDhOutput);
    
    updatedState.dhsLocal = nextLocalDH;
    updatedState.dhsRemote = remoteEphemeral;
    updatedState.rootKey = nextRootKey;
    updatedState.sendingChainKey = sendingChainKey;
    updatedState.receivingChainKey = receivingChainKey;
    updatedState.previousSendingMessageNumber = updatedState.sendingMessageNumber;
    updatedState.sendingMessageNumber = 0;
    updatedState.receivingMessageNumber = 0;
  }

  // Skip keys up to the current msgNum
  updatedState = await skipMessageKeys(updatedState, msgNum);

  // Retrieve message key
  if (!updatedState.receivingChainKey) {
    throw new Error('Receiving chain not initialized');
  }

  const { chainKey, messageKey } = await kdfChain(updatedState.receivingChainKey);
  updatedState.receivingChainKey = chainKey;
  updatedState.receivingMessageNumber = updatedState.receivingMessageNumber + 1;

  return {
    key: messageKey,
    state: updatedState
  };
}

/**
 * Record skipped keys if message sequence skipped gaps due to packet loss/out-of-order.
 */
async function skipMessageKeys(state: RatchetState, untilMsgNum: number): Promise<RatchetState> {
  if (state.receivingMessageNumber + 100 < untilMsgNum) {
    throw new Error('Too many messages skipped');
  }

  if (!state.receivingChainKey || !state.dhsRemote) {
    return state;
  }

  let currentChainKey = state.receivingChainKey;
  let currentMsgNum = state.receivingMessageNumber;
  const ephemHex = nodeIdToHex(state.dhsRemote);

  while (currentMsgNum < untilMsgNum) {
    const { chainKey, messageKey } = await kdfChain(currentChainKey);
    currentChainKey = chainKey;
    
    const key = `${ephemHex}:${currentMsgNum}`;
    state.skippedMessageKeys.set(key, messageKey);
    
    currentMsgNum++;
    
    // Enforce skipped key capacity limit
    if (state.skippedMessageKeys.size > SKIPPED_KEY_MAX) {
      // Remove oldest
      const firstKey = state.skippedMessageKeys.keys().next().value;
      if (firstKey) {
        state.skippedMessageKeys.delete(firstKey);
      }
    }
  }

  state.receivingChainKey = currentChainKey;
  state.receivingMessageNumber = currentMsgNum;
  return state;
}

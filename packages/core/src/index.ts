/**
 * @mesh/core — Barrel Export
 */

export {
  PacketType,
  TransportType,
  BatteryClass,
  MessageStatus,
  BROADCAST_DST,
  PROTOCOL_VERSION,
  DEFAULT_TTL,
  MAX_PACKET_AGE_S,
  BLE_FRAGMENT_SIZE,
  encodePacket,
  decodePacket,
  generatePacketId,
  isPacketExpired,
  bytesEqual,
  nodeIdToHex,
  hexToNodeId,
  shortNodeId,
  isBroadcast,
} from './protocol.js';

export type {
  NodeId,
  PacketId,
  MeshPacket,
  FragmentHeader,
  HelloPayload,
} from './protocol.js';

export {
  deriveNodeId,
  computeSafetyNumber,
  formatSafetyNumber,
  generateDemoIdentity,
  displayNodeId,
} from './identity.js';

export type {
  IdentityKeyPair,
  EncryptionKeyPair,
  PreKeyBundle,
  LocalIdentity,
} from './identity.js';

export {
  DeduplicationCache,
  NeighborTable,
  makeForwardDecision,
} from './routing.js';

export type {
  Neighbor,
  ForwardDecision,
} from './routing.js';

export {
  hkdfDerive,
  encryptAESGCM,
  decryptAESGCM,
  generateDHKeyPair,
  computeDHSharedSecret,
} from './crypto.js';

export type {
  DHKeyPair,
} from './crypto.js';

export {
  initializeSession,
  getSendingMessageKey,
  getSkippedMessageKey,
  getReceivingMessageKey,
} from './ratchet.js';

export type {
  KDFChainKeys,
  RatchetState,
} from './ratchet.js';

export {
  initiateX3DH,
  receiveX3DH,
} from './x3dh.js';

export type {
  PreKeyBundle as X3DHPreKeyBundle,
  X3DHResult,
} from './x3dh.js';

export {
  generateSenderKey,
  encryptGroupMessage,
  decryptGroupMessage,
} from './groups.js';

export type {
  SenderKeyChain,
  GroupSessionState,
} from './groups.js';

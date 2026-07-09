/**
 * @mesh/core — Cryptographic Primitives
 *
 * WebCrypto helpers for HKDF, AES-GCM, and X25519 key agreements.
 * Runs in both browser threads and Node.js environments.
 */

// ── HKDF-SHA256 ────────────────────────────────────────────────────────────

/**
 * Derive keying material using HKDF-SHA-256.
 */
export async function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt as any,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as any,
      info: info as any
    },
    saltKey,
    length * 8
  );

  return new Uint8Array(derived);
}

// ── AES-GCM ────────────────────────────────────────────────────────────────

/**
 * Encrypt bytes using AES-GCM (256-bit).
 */
export async function encryptAESGCM(
  key: Uint8Array,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  // Generate random 12-byte IV
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as any,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      additionalData: associatedData as any
    },
    cryptoKey,
    plaintext as any
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv
  };
}

/**
 * Decrypt bytes using AES-GCM (256-bit).
 */
export async function decryptAESGCM(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  associatedData?: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as any,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
      additionalData: associatedData as any
    },
    cryptoKey,
    ciphertext as any
  );

  return new Uint8Array(plaintext);
}

// ── X25519 Key Agreement ───────────────────────────────────────────────────

export interface DHKeyPair {
  publicKey: Uint8Array;
  privateKey: CryptoKey;
}

/**
 * Generate X25519 keypair for ephemeral/prekey DH handshakes.
 */
export async function generateDHKeyPair(): Promise<DHKeyPair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair;

  const pubExport = await crypto.subtle.exportKey('raw', pair.publicKey);

  return {
    publicKey: new Uint8Array(pubExport),
    privateKey: pair.privateKey
  };
}

/**
 * Compute shared secret using X25519 DH agreement.
 */
export async function computeDHSharedSecret(
  localPrivateKey: CryptoKey,
  remotePublicKeyRaw: Uint8Array
): Promise<Uint8Array> {
  const remoteKey = await crypto.subtle.importKey(
    'raw',
    remotePublicKeyRaw as any,
    { name: 'X25519' },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'X25519',
      public: remoteKey
    },
    localPrivateKey,
    256
  );

  return new Uint8Array(sharedSecret);
}

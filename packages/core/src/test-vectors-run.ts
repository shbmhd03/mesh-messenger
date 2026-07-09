/**
 * @mesh/core — Golden Vector Test Runner
 *
 * Runs interop validation tests against test-vectors.json.
 * Validates that codec and helper implementations match expected results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { decodePacket, encodePacket, bytesEqual, hexToNodeId, nodeIdToHex } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Test Runner ────────────────────────────────────────────────────────────

async function runTests() {
  console.log('🏁 Starting Golden Test Vectors Runner...\n');

  const vectorPath = path.resolve(__dirname, '../test-vectors.json');
  const rawData = fs.readFileSync(vectorPath, 'utf8');
  const data = JSON.parse(rawData);

  let passed = 0;
  let failed = 0;

  // 1. Packet Encoding / Decoding Tests
  const encodingTests = data.vectors.packetEncoding;
  console.log(`📦 Running Packet Codec Tests (${encodingTests.length} cases)...`);
  
  for (const t of encodingTests) {
    try {
      // Decode check
      const expectedBytes = hexToNodeId(t.expectedHex);
      const decoded = decodePacket(expectedBytes);

      if (decoded.version !== t.version) throw new Error(`Version mismatch: ${decoded.version} !== ${t.version}`);
      if (decoded.type !== t.type) throw new Error(`Type mismatch: ${decoded.type} !== ${t.type}`);
      if (nodeIdToHex(decoded.packetId) !== t.packetId) throw new Error(`PacketID mismatch: ${nodeIdToHex(decoded.packetId)} !== ${t.packetId}`);
      if (nodeIdToHex(decoded.src) !== t.src) throw new Error(`Src mismatch: ${nodeIdToHex(decoded.src)} !== ${t.src}`);
      if (nodeIdToHex(decoded.dst) !== t.dst) throw new Error(`Dst mismatch: ${nodeIdToHex(decoded.dst)} !== ${t.dst}`);
      if (decoded.ttl !== t.ttl) throw new Error(`TTL mismatch: ${decoded.ttl} !== ${t.ttl}`);
      if (decoded.hopCount !== t.hopCount) throw new Error(`HopCount mismatch: ${decoded.hopCount} !== ${t.hopCount}`);
      if (decoded.timestamp !== t.timestamp) throw new Error(`Timestamp mismatch: ${decoded.timestamp} !== ${t.timestamp}`);
      if (nodeIdToHex(decoded.payload) !== t.payload) throw new Error(`Payload mismatch: ${nodeIdToHex(decoded.payload)} !== ${t.payload}`);

      // Encode check
      const encoded = encodePacket(decoded);
      const encodedHex = nodeIdToHex(encoded);
      if (encodedHex !== t.expectedHex) {
        throw new Error(`Encode mismatch:\nExpected: ${t.expectedHex}\nGot:      ${encodedHex}`);
      }

      console.log(`  ✅ [PASS] "${t.description}"`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] "${t.description}": ${err.message}`);
      failed++;
    }
  }

  // 2. Cryptographic helper tests
  const cryptoTests = data.vectors.cryptoDerivations;
  console.log(`\n🔑 Running Cryptographic Comparison Tests (${cryptoTests.length} cases)...`);

  for (const t of cryptoTests) {
    try {
      const a = hexToNodeId(t.arrayA);
      const b = hexToNodeId(t.arrayB);
      const equalResult = bytesEqual(a, b);

      if (equalResult !== t.expectedEqual) {
        throw new Error(`Equal result mismatch: ${equalResult} !== ${t.expectedEqual}`);
      }

      console.log(`  ✅ [PASS] "${t.description}"`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] "${t.description}": ${err.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 Test Run Completed. Passed: ${passed}, Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

/**
 * Mesh Messenger Core — Packet Codec
 *
 * Binary encode/decode for MeshPacket matching the wire format exactly.
 * Must produce byte-identical output to the TypeScript and Swift implementations
 * for interoperability (validated via golden test vectors).
 */

package mesh.core.protocol

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Encode a MeshPacket into a binary frame.
 *
 * Layout:
 *   [0]       version (u8)
 *   [1]       type (u8)
 *   [2..9]    packetId (8 bytes)
 *   [10..25]  src NodeId (16 bytes)
 *   [26..41]  dst NodeId (16 bytes)
 *   [42]      ttl (u8)
 *   [43]      hopCount (u8)
 *   [44..47]  timestamp (u32 big-endian)
 *   [48..49]  payloadLength (u16 big-endian)
 *   [50..N]   payload
 *   [N+1..]   signature (optional)
 */
fun encodePacket(packet: MeshPacket): ByteArray {
    val payloadLen = packet.payload.size
    val sigLen = packet.signature?.size ?: 0
    val totalLen = MeshPacket.HEADER_SIZE + payloadLen + sigLen

    val buf = ByteBuffer.allocate(totalLen).order(ByteOrder.BIG_ENDIAN)

    buf.put(packet.version.toByte())
    buf.put(packet.type.value.toByte())
    buf.put(packet.packetId.bytes)
    buf.put(packet.src.bytes)
    buf.put(packet.dst.bytes)
    buf.put(packet.ttl.toByte())
    buf.put(packet.hopCount.toByte())
    buf.putInt(packet.timestamp.toInt())
    buf.putShort(payloadLen.toShort())
    buf.put(packet.payload)

    packet.signature?.let { buf.put(it) }

    return buf.array()
}

/**
 * Decode a binary frame into a MeshPacket.
 * @throws IllegalArgumentException on malformed input
 */
fun decodePacket(data: ByteArray): MeshPacket {
    require(data.size >= MeshPacket.HEADER_SIZE) {
        "Packet too short: ${data.size} < ${MeshPacket.HEADER_SIZE}"
    }

    val buf = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)

    val version = buf.get().toUByte()
    val type = PacketType.fromValue(buf.get().toInt())

    val packetIdBytes = ByteArray(8)
    buf.get(packetIdBytes)
    val packetId = PacketId(packetIdBytes)

    val srcBytes = ByteArray(16)
    buf.get(srcBytes)
    val src = NodeId(srcBytes)

    val dstBytes = ByteArray(16)
    buf.get(dstBytes)
    val dst = NodeId(dstBytes)

    val ttl = buf.get().toUByte()
    val hopCount = buf.get().toUByte()
    val timestamp = buf.getInt().toUInt()
    val payloadLength = buf.getShort().toInt() and 0xFFFF

    require(data.size >= MeshPacket.HEADER_SIZE + payloadLength) {
        "Payload truncated: expected $payloadLength bytes, got ${data.size - MeshPacket.HEADER_SIZE}"
    }

    val payload = ByteArray(payloadLength)
    buf.get(payload)

    val signature = if (buf.remaining() > 0) {
        ByteArray(buf.remaining()).also { buf.get(it) }
    } else null

    return MeshPacket(
        version = version,
        type = type,
        packetId = packetId,
        src = src,
        dst = dst,
        ttl = ttl,
        hopCount = hopCount,
        timestamp = timestamp,
        payload = payload,
        signature = signature,
    )
}

/**
 * Constant-time byte array comparison for MAC/fingerprint safety.
 */
fun constantTimeEquals(a: ByteArray, b: ByteArray): Boolean {
    if (a.size != b.size) return false
    var diff = 0
    for (i in a.indices) {
        diff = diff or (a[i].toInt() xor b[i].toInt())
    }
    return diff == 0
}

/**
 * Mesh Messenger Core — Wire Protocol
 *
 * Platform-agnostic packet format matching the core skill spec.
 * This is a pure Kotlin module with NO Android imports.
 */

package mesh.core.protocol

import kotlinx.serialization.Serializable
import kotlinx.serialization.protobuf.ProtoNumber

/** Packet types matching the wire format spec */
enum class PacketType(val value: Int) {
    DATA(0),
    ACK(1),
    HELLO(2),
    ROUTE_PROBE(3),
    PREKEY_REQUEST(4),
    PREKEY_BUNDLE(5),
    FRAGMENT(6);

    companion object {
        fun fromValue(value: Int): PacketType =
            entries.firstOrNull { it.value == value }
                ?: throw IllegalArgumentException("Unknown packet type: $value")
    }
}

/** Transport types */
enum class TransportType {
    BLE, WIFI_DIRECT, WIFI_AWARE, MPC, WEBRTC, RELAY
}

/** Battery class for routing decisions */
enum class BatteryClass(val priority: Int) {
    MAINS(5),
    HIGH(4),
    NORMAL(3),
    LOW(2),
    EPHEMERAL(1);
}

/** Message delivery status */
enum class MessageStatus {
    PENDING, SENT, DELIVERED, READ, FAILED
}

/** 16-byte Node ID = first 16 bytes of SHA-256(Ed25519 public key) */
@JvmInline
value class NodeId(val bytes: ByteArray) {
    init {
        require(bytes.size == 16) { "NodeId must be exactly 16 bytes, got ${bytes.size}" }
    }

    fun toHex(): String = bytes.joinToString("") { "%02x".format(it) }
    fun shortId(): String = toHex().take(8).uppercase()

    companion object {
        val BROADCAST = NodeId(ByteArray(16) { 0xFF.toByte() })
        val ZERO = NodeId(ByteArray(16))

        fun fromHex(hex: String): NodeId {
            require(hex.length == 32) { "NodeId hex must be 32 chars" }
            val bytes = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
            return NodeId(bytes)
        }
    }

    override fun toString(): String = shortId()
}

/** 8-byte random packet identifier for dedup */
@JvmInline
value class PacketId(val bytes: ByteArray) {
    init {
        require(bytes.size == 8) { "PacketId must be exactly 8 bytes" }
    }

    fun toHex(): String = bytes.joinToString("") { "%02x".format(it) }

    companion object {
        fun random(): PacketId {
            val bytes = ByteArray(8)
            java.security.SecureRandom().nextBytes(bytes)
            return PacketId(bytes)
        }
    }
}

/** Core mesh packet — matches the wire format spec */
data class MeshPacket(
    val version: UByte = PROTOCOL_VERSION,
    val type: PacketType,
    val packetId: PacketId,
    val src: NodeId,
    val dst: NodeId,
    val ttl: UByte,
    val hopCount: UByte = 0u,
    val timestamp: UInt,        // unix seconds
    val payload: ByteArray,     // ciphertext — routing nodes MUST NOT read
    val signature: ByteArray? = null,
) {
    companion object {
        /** Fixed header size: 1+1+8+16+16+1+1+4+2 = 50 bytes */
        const val HEADER_SIZE = 50
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is MeshPacket) return false
        return packetId.bytes.contentEquals(other.packetId.bytes)
    }

    override fun hashCode(): Int = packetId.bytes.contentHashCode()
}

/** Fragment header for reassembly */
data class FragmentHeader(
    val messageId: PacketId,  // groups fragments
    val index: UByte,         // 0-based
    val total: UByte,         // total count
)

/** HELLO beacon payload */
data class HelloPayload(
    val nodeId: NodeId,
    val batteryClass: BatteryClass,
    val transports: Set<TransportType>,
    val bloomFilter: ByteArray,
    val relayCapable: Boolean,
)

// ── Constants ──────────────────────────────────────────────────────────────

val PROTOCOL_VERSION: UByte = 1u
const val DEFAULT_TTL: Int = 7
const val MAX_PACKET_AGE_SECONDS: Long = 24 * 60 * 60  // 24 hours
const val BLE_FRAGMENT_SIZE: Int = 160
const val HELLO_INTERVAL_MS: Long = 20_000  // 20 seconds (between 15-30s)

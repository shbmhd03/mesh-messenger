/**
 * Mesh Messenger Core — Routing
 *
 * Deduplication cache, neighbor table, and forwarding logic.
 * Pure Kotlin — no Android imports.
 */

package mesh.core.routing

import mesh.core.protocol.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * LRU dedup cache for packet IDs.
 * Thread-safe for concurrent access from multiple transport coroutines.
 *
 * Cap: ~5,000 entries, TTL: ~10 minutes.
 */
class DeduplicationCache(
    private val maxEntries: Int = 5000,
    private val ttlMs: Long = 10 * 60 * 1000L, // 10 minutes
) {
    private data class Entry(val hex: String, val timestamp: Long)

    private val seen = ConcurrentHashMap<String, Long>()

    /**
     * Check if a packet ID has been seen recently.
     * Returns true = duplicate (drop). Returns false = new (process).
     */
    fun isDuplicate(packetId: PacketId): Boolean {
        val key = packetId.toHex()
        val now = System.currentTimeMillis()

        val existing = seen[key]
        if (existing != null && (now - existing) < ttlMs) {
            return true // duplicate
        }

        seen[key] = now

        // Prune if over capacity
        if (seen.size > (maxEntries * 1.1).toInt()) {
            prune(now)
        }

        return false
    }

    val size: Int get() = seen.size

    private fun prune(now: Long) {
        val expired = seen.entries.filter { (now - it.value) > ttlMs }
        for (entry in expired) {
            seen.remove(entry.key)
        }

        // Hard cap
        if (seen.size > maxEntries) {
            val sorted = seen.entries.sortedBy { it.value }
            val toRemove = sorted.take(sorted.size - maxEntries)
            for (entry in toRemove) {
                seen.remove(entry.key)
            }
        }
    }
}

/**
 * Neighbor entry — a directly connected or recently-seen peer.
 */
data class Neighbor(
    val nodeId: NodeId,
    val transport: TransportType,
    val batteryClass: BatteryClass,
    var lastSeen: Long,         // unix ms
    var rssi: Int? = null,      // BLE signal strength
    val hopCount: Int = 0,      // 0 = direct neighbor
    val relayCapable: Boolean = false,
    var bloomFilter: ByteArray? = null,
) {
    val displayId: String get() = nodeId.shortId()
}

/**
 * Tracks directly connected peers.
 * Thread-safe via ConcurrentHashMap.
 */
class NeighborTable(
    private val staleThresholdMs: Long = 90_000L, // 3× HELLO interval
) {
    private val neighbors = ConcurrentHashMap<String, Neighbor>()

    fun upsert(
        nodeId: NodeId,
        transport: TransportType,
        batteryClass: BatteryClass,
        relayCapable: Boolean,
        bloomFilter: ByteArray? = null,
        rssi: Int? = null,
    ) {
        val key = nodeId.toHex()
        neighbors[key] = Neighbor(
            nodeId = nodeId,
            transport = transport,
            batteryClass = batteryClass,
            lastSeen = System.currentTimeMillis(),
            rssi = rssi,
            hopCount = 0,
            relayCapable = relayCapable,
            bloomFilter = bloomFilter,
        )
    }

    fun remove(nodeId: NodeId) {
        neighbors.remove(nodeId.toHex())
    }

    fun get(nodeId: NodeId): Neighbor? {
        val n = neighbors[nodeId.toHex()] ?: return null
        if (isStale(n)) {
            neighbors.remove(nodeId.toHex())
            return null
        }
        return n
    }

    fun getAll(): List<Neighbor> {
        pruneStale()
        return neighbors.values.toList()
    }

    fun isDirectNeighbor(nodeId: NodeId): Boolean = get(nodeId) != null

    val size: Int get() {
        pruneStale()
        return neighbors.size
    }

    /**
     * Choose the best relay node: prefers mains-powered, then high battery.
     */
    fun bestRelay(): Neighbor? {
        return getAll()
            .filter { it.relayCapable }
            .maxByOrNull { it.batteryClass.priority }
    }

    private fun isStale(n: Neighbor): Boolean =
        (System.currentTimeMillis() - n.lastSeen) > staleThresholdMs

    private fun pruneStale() {
        val now = System.currentTimeMillis()
        neighbors.entries.removeIf { (now - it.value.lastSeen) > staleThresholdMs }
    }
}

/**
 * Forwarding decision for an incoming packet.
 */
sealed class ForwardDecision {
    data class Deliver(val reason: String) : ForwardDecision()
    data class Forward(
        val reason: String,
        val targets: List<NodeId>? = null,  // null = flood all
        val jitterMs: Long = 0,
    ) : ForwardDecision()
    data class Drop(val reason: String) : ForwardDecision()
}

/**
 * Decide what to do with an incoming packet.
 */
fun makeForwardDecision(
    packet: MeshPacket,
    ownNodeId: NodeId,
    neighbors: NeighborTable,
    dedup: DeduplicationCache,
): ForwardDecision {
    // Dedup
    if (dedup.isDuplicate(packet.packetId)) {
        return ForwardDecision.Drop("duplicate")
    }

    // Expired
    val nowSeconds = System.currentTimeMillis() / 1000
    if ((nowSeconds - packet.timestamp.toLong()) > MAX_PACKET_AGE_SECONDS) {
        return ForwardDecision.Drop("expired")
    }

    // For us?
    if (constantTimeEquals(packet.dst.bytes, ownNodeId.bytes)) {
        return ForwardDecision.Deliver("addressed to us")
    }

    // Broadcast
    if (constantTimeEquals(packet.dst.bytes, NodeId.BROADCAST.bytes)) {
        return ForwardDecision.Deliver("broadcast")
    }

    // TTL exhausted
    if (packet.ttl <= 0u) {
        return ForwardDecision.Drop("TTL exhausted")
    }

    // Directed shortcut: if dst is a direct neighbor, unicast
    if (neighbors.isDirectNeighbor(packet.dst)) {
        return ForwardDecision.Forward(
            reason = "direct neighbor",
            targets = listOf(packet.dst),
            jitterMs = 0,
        )
    }

    // Default: flood with jitter (50-300ms)
    val jitter = 50L + (Math.random() * 250).toLong()
    return ForwardDecision.Forward(reason = "flood", jitterMs = jitter)
}

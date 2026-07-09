import Foundation

/**
 * LRU dedup cache for packet IDs.
 * Thread-safe for concurrent access using NSLock.
 */
public class DeduplicationCache {
    private let maxEntries: Int
    private let ttl: TimeInterval
    private var seen = [String: Date]() // Hex(packetId) -> Discovery date
    private let lock = NSLock()

    public init(maxEntries: Int = 5000, ttl: TimeInterval = 600) {
        self.maxEntries = maxEntries;
        self.ttl = ttl;
    }

    /**
     * Returns true = duplicate (drop). Returns false = new (process).
     */
    public func isDuplicate(_ packetId: PacketId) -> Bool {
        let key = packetId.toHex()
        let now = Date()
        
        lock.lock()
        defer { lock.unlock() }
        
        if let existing = seen[key], now.timeIntervalSince(existing) < ttl {
            return true
        }
        
        seen[key] = now
        
        if seen.count > Int(Double(maxEntries) * 1.1) {
            prune(now)
        }
        
        return false
    }
    
    private func prune(_ now: Date) {
        // Prune expired
        for (key, date) in seen {
            if now.timeIntervalSince(date) >= ttl {
                seen.removeValue(forKey: key)
            }
        }
        
        // Prune down to maxEntries if still above
        if seen.count > maxEntries {
            let sorted = seen.sorted { $0.value < $1.value }
            let toRemove = sorted.prefix(seen.count - maxEntries)
            for item in toRemove {
                seen.removeValue(forKey: item.key)
            }
        }
    }
}

/**
 * Neighbor tracking table.
 */
public struct Neighbor {
    public let nodeId: NodeId
    public let transport: TransportType
    public let batteryClass: BatteryClass
    public var lastSeen: Date
    public var rssi: Int?
    public var hopCount: Int
    public var relayCapable: Bool
    public var bloomFilter: Data?
    
    public var displayId: String {
        return nodeId.shortId()
    }
}

public class NeighborTable {
    private var neighbors = [String: Neighbor]()
    private let staleThreshold: TimeInterval
    private val lock = NSLock()
    
    public init(staleThreshold: TimeInterval = 90) {
        self.staleThreshold = staleThreshold
    }
    
    public func upsert(
        nodeId: NodeId,
        transport: TransportType,
        batteryClass: BatteryClass,
        relayCapable: Bool,
        bloomFilter: Data? = nil,
        rssi: Int? = nil
    ) {
        let key = nodeId.toHex()
        lock.lock()
        defer { lock.unlock() }
        
        neighbors[key] = Neighbor(
            nodeId: nodeId,
            transport: transport,
            batteryClass: batteryClass,
            lastSeen: Date(),
            rssi: rssi,
            hopCount: 0,
            relayCapable: relayCapable,
            bloomFilter: bloomFilter
        )
    }
    
    public func remove(_ nodeId: NodeId) {
        lock.lock()
        defer { lock.unlock() }
        neighbors.removeValue(forKey: nodeId.toHex())
    }
    
    public func get(_ nodeId: NodeId) -> Neighbor? {
        lock.lock()
        defer { lock.unlock() }
        
        guard let n = neighbors[nodeId.toHex()] else { return nil }
        if Date().timeIntervalSince(n.lastSeen) > staleThreshold {
            neighbors.removeValue(forKey: nodeId.toHex())
            return nil
        }
        return n
    }
    
    public func getAll() -> [Neighbor] {
        lock.lock()
        defer { lock.unlock() }
        pruneStale()
        return Array(neighbors.values)
    }
    
    public func isDirectNeighbor(_ nodeId: NodeId) -> Bool {
        return get(nodeId) != nil
    }
    
    public func bestRelay() -> Neighbor? {
        return getAll()
            .filter { $0.relayCapable }
            .max { $0.batteryClass.priority < $1.batteryClass.priority }
    }
    
    private func pruneStale() {
        let now = Date()
        for (key, n) in neighbors {
            if now.timeIntervalSince(n.lastSeen) > staleThreshold {
                neighbors.removeValue(forKey: key)
            }
        }
    }
}

public enum ForwardAction {
    case deliver(reason: String)
    case forward(reason: String, targets: [NodeId]?, jitterMs: Int)
    case drop(reason: String)
}

public func makeForwardDecision(
    packet: MeshPacket,
    ownNodeId: NodeId,
    neighbors: NeighborTable,
    dedup: DeduplicationCache
) -> ForwardAction {
    if dedup.isDuplicate(packet.packetId) {
        return .drop(reason: "duplicate")
    }
    
    let nowSeconds = UInt32(Date().timeIntervalSince1970)
    if nowSeconds - packet.timestamp > UInt32(MAX_PACKET_AGE_SECONDS) {
        return .drop(reason: "expired")
    }
    
    if constantTimeEquals(packet.dst, ownNodeId) {
        return .deliver(reason: "addressed to us")
    }
    
    if constantTimeEquals(packet.dst, BROADCAST_DST) {
        return .deliver(reason: "broadcast")
    }
    
    if packet.ttl <= 0 {
        return .drop(reason: "TTL exhausted")
    }
    
    if neighbors.isDirectNeighbor(packet.dst) {
        return .forward(reason: "direct neighbor", targets: [packet.dst], jitterMs: 0)
    }
    
    let jitter = 50 + Int(arc4random_uniform(250)) // 50-300ms random delay
    return .forward(reason: "flood", targets: nil, jitterMs: jitter)
}

import Foundation

public enum PacketType: UInt8 {
    case data = 0
    case ack = 1
    case hello = 2
    case routeProbe = 3
    case prekeyRequest = 4
    case prekeyBundle = 5
    case fragment = 6
}

public enum TransportType: String, Codable {
    case ble = "ble"
    case wifiDirect = "wifi-direct"
    case wifiAware = "wifi-aware"
    case mpc = "mpc"
    case webrtc = "webrtc"
    case relay = "relay"
}

public enum BatteryClass: String, Codable {
    case mains = "mains"
    case high = "high"
    case normal = "normal"
    case low = "low"
    case ephemeral = "ephemeral"

    public var priority: Int {
        switch self {
        case .mains: return 5
        case .high: return 4
        case .normal: return 3
        case .low: return 2
        case .ephemeral: return 1
        }
    }
}

public enum MessageStatus: String, Codable {
    case pending = "pending"
    case sent = "sent"
    case delivered = "delivered"
    case read = "read"
    case failed = "failed"
}

public typealias NodeId = Data
public typealias PacketId = Data

public let PROTOCOL_VERSION: UInt8 = 1
public let DEFAULT_TTL: UInt8 = 7
public let MAX_PACKET_AGE_SECONDS: TimeInterval = 24 * 60 * 60
public let BLE_FRAGMENT_SIZE = 160
public let BROADCAST_DST = Data(repeating: 0xFF, count: 16)

public struct MeshPacket: Equatable {
    public let version: UInt8
    public let type: PacketType
    public let packetId: PacketId
    public let src: NodeId
    public let dst: NodeId
    public let ttl: UInt8
    public let hopCount: UInt8
    public let timestamp: UInt32
    public let payload: Data
    public let signature: Data?

    public static let headerSize = 50

    public init(
        version: UInt8 = PROTOCOL_VERSION,
        type: PacketType,
        packetId: PacketId,
        src: NodeId,
        dst: NodeId,
        ttl: UInt8 = DEFAULT_TTL,
        hopCount: UInt8 = 0,
        timestamp: UInt32,
        payload: Data,
        signature: Data? = nil
    ) {
        self.version = version
        self.type = type
        self.packetId = packetId
        self.src = src
        self.dst = dst
        self.ttl = ttl
        self.hopCount = hopCount
        self.timestamp = timestamp
        self.payload = payload
        self.signature = signature
    }

    public static func == (lhs: MeshPacket, rhs: MeshPacket) -> Bool {
        return lhs.packetId == rhs.packetId
    }
}

public struct FragmentHeader {
    public let messageId: PacketId
    public let index: UInt8
    public let total: UInt8
}

public struct HelloPayload: Codable {
    public let nodeId: NodeId
    public let batteryClass: BatteryClass
    public let transports: [TransportType]
    public let bloomFilter: Data
    public let relayCapable: Bool
}

extension Data {
    public func toHex() -> String {
        return map { String(format: "%02x", $0) }.joined()
    }

    public func shortId() -> String {
        return toHex().prefix(8).uppercased()
    }
}

import Foundation
import GRDB
import MeshCore

public struct ContactRecord: Codable, FetchableRecord, MutablePersistableRecord, TableRecord {
    public static let databaseTableName = "contacts"
    
    public var nodeId: String // Hex
    public var identityKey: Data
    public var verified: Bool
    
    public init(nodeId: String, identityKey: Data, verified: Bool) {
        self.nodeId = nodeId
        self.identityKey = identityKey
        self.verified = verified
    }
}

public struct SessionRecord: Codable, FetchableRecord, MutablePersistableRecord, TableRecord {
    public static let databaseTableName = "sessions"
    
    public var nodeId: String // Hex of peer NodeID
    public var serializedState: Data
    
    public init(nodeId: String, serializedState: Data) {
        self.nodeId = nodeId
        self.serializedState = serializedState
    }
}

public struct MessageRecord: Codable, FetchableRecord, MutablePersistableRecord, TableRecord {
    public static let databaseTableName = "messages"
    
    public var id: String
    public var convoId: String
    public var isSent: Bool
    public var status: String
    public var timestamp: Int64 // Epoch ms
    public var ciphertext: Data
    
    public init(id: String, convoId: String, isSent: Bool, status: String, timestamp: Int64, ciphertext: Data) {
        self.id = id
        self.convoId = convoId
        self.isSent = isSent
        self.status = status
        self.timestamp = timestamp
        self.ciphertext = ciphertext
    }
}

public struct OutboxRecord: Codable, FetchableRecord, MutablePersistableRecord, TableRecord {
    public static let databaseTableName = "outbox"
    
    public var packetId: String
    public var destNodeId: String
    public var status: String
    public var data: Data
    public var retryCount: Int
    public var lastRetryTime: Int64
    
    public init(packetId: String, destNodeId: String, status: String, data: Data, retryCount: Int = 0, lastRetryTime: Int64 = 0) {
        self.packetId = packetId
        self.destNodeId = destNodeId
        self.status = status
        self.data = data
        self.retryCount = retryCount
        self.lastRetryTime = lastRetryTime
    }
}

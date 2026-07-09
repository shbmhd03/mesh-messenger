import Foundation
import GRDB

public class EncryptedStore {
    private let dbQueue: DatabaseQueue
    
    public init(databaseURL: URL, passphraseData: Data) throws {
        var config = Configuration()
        
        // Apply SQLCipher passphrase securely on database connection opening
        config.prepareDatabase = { db in
            try db.usePassphrase(passphraseData)
        }
        
        self.dbQueue = try DatabaseQueue(path: databaseURL.path, configuration: config)
        try setupSchema()
    }
    
    private func setupSchema() throws {
        try dbQueue.write { db in
            // Contacts table
            try db.create(table: "contacts", ifNotExists: true) { t in
                t.column("nodeId", .text).primaryKey()
                t.column("identityKey", .blob).notNull()
                t.column("verified", .boolean).notNull()
            }
            
            // Sessions table
            try db.create(table: "sessions", ifNotExists: true) { t in
                t.column("nodeId", .text).primaryKey()
                t.column("serializedState", .blob).notNull()
            }
            
            // Messages table
            try db.create(table: "messages", ifNotExists: true) { t in
                t.column("id", .text).primaryKey()
                t.column("convoId", .text).notNull()
                t.column("isSent", .boolean).notNull()
                t.column("status", .text).notNull()
                t.column("timestamp", .integer).notNull()
                t.column("ciphertext", .blob).notNull()
            }
            
            // Outbox table
            try db.create(table: "outbox", ifNotExists: true) { t in
                t.column("packetId", .text).primaryKey()
                t.column("destNodeId", .text).notNull()
                t.column("status", .text).notNull()
                t.column("data", .blob).notNull()
                t.column("retryCount", .integer).notNull()
                t.column("lastRetryTime", .integer).notNull()
            }
        }
    }
    
    public func write<T>(_ updates: (Database) throws -> T) throws -> T {
        return try dbQueue.write(updates)
    }
    
    public func read<T>(_ value: (Database) throws -> T) throws -> T {
        return try dbQueue.read(value)
    }
}

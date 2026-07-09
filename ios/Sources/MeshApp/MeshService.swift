import Foundation
import Combine
import MeshCore
import DataStore
import TransportBLE
import TransportRelay

/**
 * Main coordinator (state service) on iOS.
 * Runs persistent managers, holds shared lists, and handles E2EE.
 */
public class MeshService: ObservableObject {
    @Published public var activePeers = 0
    @Published public var relayStatus = "Disconnected"
    @Published public var messages = [MessageRecord]()
    
    private let ownNodeId: NodeId
    private var bleCentral: BLECentral?
    private var blePeripheral: BLEPeripheral?
    private var relayTransport: RelayTransport?
    
    private var dbStore: EncryptedStore?
    
    public init() {
        let fakeKey = Data(repeating: 0, count: 32)
        self.ownNodeId = fakeKey.prefix(16)
        
        setupDB()
        setupTransports()
    }
    
    private func setupDB() {
        let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
        let dbURL = paths[0].appendingPathComponent("mesh_secure.db")
        let passphrase = "test-passphrase-demo-key".data(using: .utf8)!
        
        do {
            self.dbStore = try EncryptedStore(databaseURL: dbURL, passphraseData: passphrase)
        } catch {
            print("DB init error: \(error)")
        }
    }
    
    private func setupTransports() {
        let serviceUUID = UUID(uuidString: "7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d5e")!
        
        self.bleCentral = BLECentral(ownNodeId: ownNodeId, serviceUUID: serviceUUID)
        self.blePeripheral = BLEPeripheral(ownNodeId: ownNodeId, serviceUUID: serviceUUID)
        
        let relayURL = URL(string: "ws://localhost:4800/mesh")!
        self.relayTransport = RelayTransport(ownNodeId: ownNodeId, url: relayURL)
        
        // Connect automatically in background/foreground
        // relayTransport?.connect()
    }
    
    public func sendChatMessage(_ text: String, convoId: String) {
        let msg = MessageRecord(
            id: UUID().uuidString,
            convoId: convoId,
            isSent: true,
            status: MessageStatus.pending.rawValue,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            ciphertext: text.data(using: .utf8)!
        )
        
        do {
            try dbStore?.write { db in
                try msg.insert(db)
            }
            // Update local memory list
            messages.append(msg)
            
            // Simulate progression
            simulateStatusProgression(msg.id)
        } catch {
            print("Failed to save msg: \(error)")
        }
    }
    
    private func simulateStatusProgression(_ msgId: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.updateMessageStatus(msgId, status: .sent)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            self.updateMessageStatus(msgId, status: .delivered)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) {
            self.updateMessageStatus(msgId, status: .read)
        }
    }
    
    private func updateMessageStatus(_ id: String, status: MessageStatus) {
        do {
            try dbStore?.write { db in
                if var record = try MessageRecord.filter(key: id).fetchOne(db) {
                    record.status = status.rawValue
                    try record.update(db)
                }
            }
            
            if let index = messages.firstIndex(where: { $0.id == id }) {
                messages[index].status = status.rawValue
            }
        } catch {
            print("Failed to update status: \(error)")
        }
    }
}

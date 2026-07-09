import Foundation
import MeshCore

public protocol RelayTransportDelegate: AnyObject {
    func relayTransport(_ transport: RelayTransport, didConnectToNode nodeId: String)
    func relayTransport(_ transport: RelayTransport, didReceivePacketData base64Data: String, from peer: String)
    func relayTransport(_ transport: RelayTransport, didUpdatePeerCount count: Int)
    func relayTransport(_ transport: RelayTransport, didEncounterError error: String)
    func relayTransportDidDisconnect(_ transport: RelayTransport)
}

public class RelayTransport: NSObject {
    private let ownNodeId: NodeId
    private let url: URL
    private var webSocketTask: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .default)
    
    public weak var delegate: RelayTransportDelegate?
    
    public init(ownNodeId: NodeId, url: URL) {
        self.ownNodeId = ownNodeId
        self.url = url
    }
    
    public func connect() {
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        
        // Auto register
        let regMessage: [String: Any] = [
            "type": "register",
            "nodeId": ownNodeId.toHex()
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: regMessage),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            send(text: jsonString)
        }
        
        listen()
    }
    
    public func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        delegate?.relayTransportDidDisconnect(self)
    }
    
    private func listen() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.parseMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.parseMessage(text)
                    }
                @unknown default:
                    break
                }
                self.listen()
            case .failure(let error):
                self.delegate?.relayTransport(self, didEncounterError: error.localizedDescription)
            }
        }
    }
    
    private func parseMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        
        let type = json["type"] as? String
        
        switch type {
        case "registered":
            let count = json["peerCount"] as? Int ?? 0
            delegate?.relayTransport(self, didConnectToNode: ownNodeId.toHex())
            delegate?.relayTransport(self, didUpdatePeerCount: count)
        case "packet":
            if let from = json["fromNodeId"] as? String,
               let packetData = json["data"] as? String {
                delegate?.relayTransport(self, didReceivePacketData: packetData, from: from)
            }
        case "peers":
            let count = json["count"] as? Int ?? 0
            delegate?.relayTransport(self, didUpdatePeerCount: count)
        case "error":
            let err = json["error"] as? String ?? ""
            delegate?.relayTransport(self, didEncounterError: err)
        default:
            break
        }
    }
    
    public func sendPacket(destNodeId: String, base64Data: String, packetId: String) {
        let msg: [String: Any] = [
            "type": "packet",
            "destNodeId": destNodeId,
            "data": base64Data,
            "packetId": packetId
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: msg),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            send(text: jsonString)
        }
    }
    
    public func requestPeers() {
        let msg = ["type": "peers"]
        if let jsonData = try? JSONSerialization.data(withJSONObject: msg),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            send(text: jsonString)
        }
    }
    
    private func send(text: String) {
        webSocketTask?.send(.string(text)) { [weak self] error in
            if let error = error, let self = self {
                self.delegate?.relayTransport(self, didEncounterError: error.localizedDescription)
            }
        }
    }
}

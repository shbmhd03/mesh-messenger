import Foundation
import MultipeerConnectivity
import MeshCore

public protocol MultipeerTransportDelegate: AnyObject {
    func multipeerTransport(_ transport: MultipeerTransport, didReceiveData data: Data, from peer: NodeId)
}

public class MultipeerTransport: NSObject, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate, MCSessionDelegate {
    private let ownNodeId: NodeId
    private let serviceType = "mesh-msg" // Max 15 chars alphanumeric/hyphen
    
    private var peerID: MCPeerID!
    private var advertiser: MCNearbyServiceAdvertiser!
    private var browser: MCNearbyServiceBrowser!
    private var session: MCSession!
    
    public weak var delegate: MultipeerTransportDelegate?
    
    public init(ownNodeId: NodeId) {
        self.ownNodeId = ownNodeId
        super.init()
        
        self.peerID = MCPeerID(displayName: ownNodeId.shortId())
        
        self.session = MCSession(peer: peerID, securityIdentity: nil, encryptionPreference: .required)
        self.session.delegate = self
        
        self.advertiser = MCNearbyServiceAdvertiser(peer: peerID, discoveryInfo: nil, serviceType: serviceType)
        self.advertiser.delegate = self
        
        self.browser = MCNearbyServiceBrowser(peer: peerID, serviceType: serviceType)
        self.browser.delegate = self
    }
    
    public func start() {
        advertiser.startAdvertisingPeer()
        browser.startBrowsingForPeers()
    }
    
    public func stop() {
        advertiser.stopAdvertisingPeer()
        browser.stopBrowsingForPeers()
        session.disconnect()
    }
    
    // ── MCNearbyServiceAdvertiserDelegate ──────────────────────────────────
    
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // Automatically accept invitations for our secure cluster
        invitationHandler(true, session)
    }
    
    // ── MCNearbyServiceBrowserDelegate ─────────────────────────────────────
    
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
        // Invite discovered peer to join the session
        browser.invitePeer(peerID, to: session, withContext: nil, timeout: 30)
    }
    
    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        // Handle lost peer
    }
    
    // ── MCSessionDelegate ──────────────────────────────────────────────────
    
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        // Connection status tracking
    }
    
    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        delegate?.multipeerTransport(self, didReceiveData: data, from: ownNodeId)
    }
    
    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    
    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    
    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

package mesh.transport.wifi

import android.content.Context
import android.net.wifi.aware.WifiAwareManager
import android.net.wifi.p2p.WifiP2pManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import mesh.core.protocol.NodeId
import mesh.core.protocol.TransportType

sealed class WifiEvent {
    data class PeerFound(val nodeId: NodeId, val transport: TransportType) : WifiEvent()
    data class PeerLost(val nodeId: NodeId) : WifiEvent()
    data class DataReceived(val from: NodeId, val data: ByteArray) : WifiEvent()
    data class ConnectionStatusChanged(val isConnected: Boolean) : WifiEvent()
}

class WifiTransport(
    private val context: Context
) {
    private val _events = MutableSharedFlow<WifiEvent>()
    val events: Flow<WifiEvent> = _events.asSharedFlow()

    private val wifiAwareManager = context.getSystemService(Context.WIFI_AWARE_SERVICE) as WifiAwareManager?
    private val wifiP2pManager = context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager?

    fun isWifiAwareSupported(): Boolean {
        return wifiAwareManager != null
    }

    fun isWifiDirectSupported(): Boolean {
        return wifiP2pManager != null
    }

    suspend fun startDiscovery() {
        // Mock Wi-Fi Aware / Direct discovery
        // In full implementation, set up NanDiscoverySession or WifiP2pManager discovery
    }

    suspend fun stopDiscovery() {
        // Clean up WifiAware and P2P sessions
    }

    suspend fun sendData(peerNodeId: NodeId, data: ByteArray) {
        // Open a direct TCP socket or channel to peer IP negotiated via Aware/Direct
    }
}

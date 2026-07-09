package mesh.transport.relay

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import mesh.core.protocol.NodeId
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

sealed class RelayEvent {
    data class Connected(val nodeId: String) : RelayEvent()
    data class Disconnected(val reason: String) : RelayEvent()
    data class PacketReceived(val fromNodeId: String, val base64Data: String) : RelayEvent()
    data class PeerCountChanged(val count: Int) : RelayEvent()
    data class Error(val message: String) : RelayEvent()
}

class RelayTransport(
    private val ownNodeId: NodeId,
    private val relayUrl: String
) {
    private val _events = MutableSharedFlow<RelayEvent>()
    val events: Flow<RelayEvent> = _events.asSharedFlow()

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS) // Keep alive
        .build()

    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun connect() {
        val request = Request.Builder().url(relayUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // Register NodeID on socket opening
                val regMsg = JSONObject().apply {
                    put("type", "register")
                    put("nodeId", ownNodeId.toHex())
                }
                webSocket.send(regMsg.toString())
                scope.launch {
                    _events.emit(RelayEvent.Connected(ownNodeId.toHex()))
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    when (msg.optString("type")) {
                        "registered" -> {
                            val count = msg.optInt("peerCount", 0)
                            scope.launch {
                                _events.emit(RelayEvent.PeerCountChanged(count))
                            }
                        }
                        "packet" -> {
                            val from = msg.optString("fromNodeId")
                            val data = msg.optString("data")
                            scope.launch {
                                _events.emit(RelayEvent.PacketReceived(from, data))
                            }
                        }
                        "peers" -> {
                            val count = msg.optInt("count", 0)
                            scope.launch {
                                _events.emit(RelayEvent.PeerCountChanged(count))
                            }
                        }
                        "error" -> {
                            val error = msg.optString("error")
                            scope.launch {
                                _events.emit(RelayEvent.Error(error))
                            }
                        }
                    }
                } catch (e: Exception) {
                    scope.launch {
                        _events.emit(RelayEvent.Error("Failed to parse msg: ${e.message}"))
                    }
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch {
                    _events.emit(RelayEvent.Disconnected(reason))
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch {
                    _events.emit(RelayEvent.Error(t.message ?: "Connection failure"))
                }
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "User initiated disconnect")
        webSocket = null
    }

    fun sendPacket(destNodeId: String, base64Data: String, packetId: String) {
        val payload = JSONObject().apply {
            put("type", "packet")
            put("destNodeId", destNodeId)
            put("data", base64Data)
            put("packetId", packetId)
        }
        webSocket?.send(payload.toString())
    }

    fun requestPeers() {
        val payload = JSONObject().apply {
            put("type", "peers")
        }
        webSocket?.send(payload.toString())
    }
}

/**
 * BLE Transport — Dual-role GATT (Central + Peripheral)
 *
 * Every node is BOTH GATT peripheral (advertiser) and central (scanner)
 * simultaneously. This is what makes true mesh possible on Android.
 *
 * Critical rules from the Android skill:
 * - Always scan with ScanFilter on service UUID
 * - Serialize ALL GATT operations (queue them)
 * - requestMtu(517) on connect
 * - Handle status 133 with close() + delayed retry
 * - Role-collision dedup: lower NodeId stays central
 * - Cap concurrent GATT connections at ~4-7
 */

package mesh.transport.ble

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import androidx.annotation.RequiresPermission
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import mesh.core.protocol.*
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

// ── UUIDs ──────────────────────────────────────────────────────────────

/** Fixed 128-bit service UUID for Mesh Messenger */
val MESH_SERVICE_UUID: UUID = UUID.fromString("7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d5e")

/** TX characteristic — peer writes inbound frames (WRITE_NO_RESPONSE) */
val TX_CHAR_UUID: UUID = UUID.fromString("7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d5f")

/** RX characteristic — notify outbound frames */
val RX_CHAR_UUID: UUID = UUID.fromString("7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d60")

/** Handshake characteristic — hello/identity exchange */
val HANDSHAKE_CHAR_UUID: UUID = UUID.fromString("7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d61")

/** Client Characteristic Configuration Descriptor for notifications */
val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

// ── Events ─────────────────────────────────────────────────────────────

sealed class BleEvent {
    data class PeerFound(val nodeId: NodeId, val rssi: Int) : BleEvent()
    data class PeerLost(val nodeId: NodeId) : BleEvent()
    data class PeerConnected(val nodeId: NodeId) : BleEvent()
    data class PeerDisconnected(val nodeId: NodeId) : BleEvent()
    data class DataReceived(val from: NodeId, val data: ByteArray) : BleEvent()
    data class Error(val message: String, val cause: Throwable? = null) : BleEvent()
}

// ── GATT Operation Queue ───────────────────────────────────────────────

/**
 * Android's BluetoothGatt is NOT reentrant. We must serialize all
 * GATT operations and only issue the next one after the previous
 * callback fires. Most BLE bugs on Android come from violating this.
 */
private sealed class GattOp {
    data class Write(val char: BluetoothGattCharacteristic, val data: ByteArray) : GattOp()
    data class Read(val char: BluetoothGattCharacteristic) : GattOp()
    data class RequestMtu(val mtu: Int) : GattOp()
    data class SetNotification(val char: BluetoothGattCharacteristic, val enable: Boolean) : GattOp()
}

class GattOperationQueue {
    private val queue = ConcurrentLinkedQueue<Pair<GattOp, CompletableDeferred<Boolean>>>()
    private var busy = false

    suspend fun enqueue(gatt: BluetoothGatt, op: GattOp): Boolean {
        val deferred = CompletableDeferred<Boolean>()
        queue.add(op to deferred)
        processNext(gatt)
        return deferred.await()
    }

    fun onOperationComplete() {
        busy = false
        // Will be driven by the caller after callback
    }

    @RequiresPermission(Manifest.permission.BLUETOOTH_CONNECT)
    private fun processNext(gatt: BluetoothGatt) {
        if (busy) return
        val (op, deferred) = queue.poll() ?: return
        busy = true

        val success = when (op) {
            is GattOp.Write -> {
                op.char.value = op.data
                gatt.writeCharacteristic(op.char)
            }
            is GattOp.Read -> gatt.readCharacteristic(op.char)
            is GattOp.RequestMtu -> gatt.requestMtu(op.mtu)
            is GattOp.SetNotification -> {
                val result = gatt.setCharacteristicNotification(op.char, op.enable)
                if (result && op.enable) {
                    val descriptor = op.char.getDescriptor(CCCD_UUID)
                    descriptor?.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    gatt.writeDescriptor(descriptor)
                }
                result
            }
        }

        if (!success) {
            busy = false
            deferred.complete(false)
            // Process next
            processNext(gatt)
        }
    }
}

// ── Connection Tracker ─────────────────────────────────────────────────

data class BleConnection(
    val nodeId: NodeId,
    val gatt: BluetoothGatt?,
    val role: ConnectionRole,
    val mtu: Int = 23,
    val opQueue: GattOperationQueue = GattOperationQueue(),
)

enum class ConnectionRole { CENTRAL, PERIPHERAL }

/**
 * Manages concurrent GATT connections.
 * Cap at MAX_CONNECTIONS to avoid radio congestion.
 */
class ConnectionTracker(
    private val maxConnections: Int = 5,
) {
    private val connections = ConcurrentHashMap<String, BleConnection>()

    fun add(nodeId: NodeId, gatt: BluetoothGatt?, role: ConnectionRole) {
        connections[nodeId.toHex()] = BleConnection(nodeId, gatt, role)
    }

    fun remove(nodeId: NodeId) {
        connections.remove(nodeId.toHex())
    }

    fun get(nodeId: NodeId): BleConnection? = connections[nodeId.toHex()]

    fun updateMtu(nodeId: NodeId, mtu: Int) {
        connections[nodeId.toHex()]?.let {
            connections[nodeId.toHex()] = it.copy(mtu = mtu)
        }
    }

    fun canAcceptMore(): Boolean = connections.size < maxConnections

    fun all(): List<BleConnection> = connections.values.toList()

    val count: Int get() = connections.size

    /**
     * Role collision resolution: if both sides connect to each other,
     * keep the link where the lexicographically smaller NodeId is central.
     * Returns true if WE should be central for this peer.
     */
    fun shouldBeCentral(ownNodeId: NodeId, peerNodeId: NodeId): Boolean {
        return ownNodeId.toHex() < peerNodeId.toHex()
    }
}

// ── Scan Duty Cycling ──────────────────────────────────────────────────

/**
 * Scan configuration matching the Android skill:
 * - 8s scan / 22s idle in foreground
 * - Always with ScanFilter on service UUID
 * - Never start/stop scans in tight loops (5-per-30s throttle)
 */
data class ScanConfig(
    val scanDurationMs: Long = 8_000,
    val idleDurationMs: Long = 22_000,
    val lowPowerMode: Boolean = false,
) {
    val scanMode: Int
        get() = if (lowPowerMode) {
            ScanSettings.SCAN_MODE_LOW_POWER
        } else {
            ScanSettings.SCAN_MODE_BALANCED
        }
}

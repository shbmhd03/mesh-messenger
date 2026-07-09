package mesh.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import mesh.core.protocol.BatteryClass
import mesh.core.protocol.NodeId
import mesh.core.protocol.TransportType
import mesh.transport.ble.BleEvent
import mesh.transport.relay.RelayEvent
import mesh.transport.relay.RelayTransport

class MeshService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.Default + serviceJob)

    private lateinit var notificationManager: NotificationManager
    private var peerCount = 0
    private var relayStatus = "Disconnected"

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        // Monitor transport loops
        startMeshNetwork()
    }

    private fun startMeshNetwork() {
        serviceScope.launch {
            // Mock BLE scanning & Advertising loops
            // Monitor peer count and update notification
            while (isActive) {
                delay(5000)
                updateNotification()
            }
        }
    }

    private fun updateNotification() {
        notificationManager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val contentText = "$peerCount peers active | Relay: $relayStatus"
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Mesh Messenger Active")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Mesh Messenger Background Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps BLE mesh and internet relays active in the background"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
    }

    companion object {
        private const val NOTIFICATION_ID = 101
        private const val CHANNEL_ID = "mesh_service_channel"
    }
}

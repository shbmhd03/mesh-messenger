package mesh.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import mesh.app.ui.ChatMessage
import mesh.app.ui.ChatScreen
import mesh.core.protocol.MessageStatus

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Start background mesh service
        val serviceIntent = Intent(this, MeshService::class.java)
        startService(serviceIntent)

        // Mock chat messages matching the webapp's Aisha chat history
        val demoMessages = listOf(
            ChatMessage("m1", "Hey! Are you at the festival site?", false, System.currentTimeMillis() - 45 * 60000, MessageStatus.READ, "ble"),
            ChatMessage("m2", "Yeah, just arrived. Setting up the node near the main stage", true, System.currentTimeMillis() - 42 * 60000, MessageStatus.READ, "ble"),
            ChatMessage("m3", "Perfect. I can see your node from here — 1 hop, strong signal", false, System.currentTimeMillis() - 40 * 60000, MessageStatus.READ, "ble"),
            ChatMessage("m4", "I'm seeing about 12 nodes in the mesh already. Pretty good coverage for setup day", true, System.currentTimeMillis() - 35 * 60000, MessageStatus.READ, "ble"),
            ChatMessage("m5", "Nice! The BLE range is better than expected. I'm getting 3-hop delivery to the parking area", false, System.currentTimeMillis() - 30 * 60000, MessageStatus.READ, "ble"),
            ChatMessage("m6", "Let me check the relay bridge...", true, System.currentTimeMillis() - 25 * 60000, MessageStatus.DELIVERED, "ble"),
            ChatMessage("m7", "Relay is online. We're bridging to the downtown mesh island 🌐", true, System.currentTimeMillis() - 20 * 60000, MessageStatus.DELIVERED, "relay"),
            ChatMessage("m8", "That's amazing. Full coverage from here to downtown, all encrypted", false, System.currentTimeMillis() - 5 * 60000, MessageStatus.READ, "relay"),
            ChatMessage("m9", "The mesh propagation is looking solid across the park 🛜", false, System.currentTimeMillis() - 2 * 60000, MessageStatus.READ, "ble")
        )

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ChatScreen(
                        contactName = "Aisha Rahman",
                        hopCount = 1,
                        transport = "ble",
                        messages = demoMessages,
                        onSendMessage = { text ->
                            // Handle send packet logic here
                        },
                        onVerifyClick = {
                            // Show safety verification screen
                        }
                    )
                }
            }
        }
    }
}

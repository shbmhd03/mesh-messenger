package mesh.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import mesh.core.protocol.MessageStatus

@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey val nodeId: String, // Hex string
    val identityKey: ByteArray,
    val verified: Boolean
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ContactEntity) return false
        return nodeId == other.nodeId
    }

    override fun hashCode(): Int = nodeId.hashCode()
}

@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey val nodeId: String, // Hex string of peer NodeId
    val serializedState: ByteArray // Serliazed ratchet state BLOB
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SessionEntity) return false
        return nodeId == other.nodeId
    }

    override fun hashCode(): Int = nodeId.hashCode()
}

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val id: String,
    val convoId: String, // Conversation group or contact NodeID
    val isSent: Boolean, // True = outbound, False = inbound
    val status: String, // MessageStatus string (PENDING, SENT, DELIVERED, READ, FAILED)
    val timestamp: Long, // Epoch ms
    val ciphertext: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is MessageEntity) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}

@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey val packetId: String,
    val destNodeId: String,
    val status: String, // PENDING, IN_FLIGHT, SENT, FAILED
    val data: ByteArray, // Encoded MeshPacket binary frame
    val retryCount: Int = 0,
    val lastRetryTime: Long = 0L
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is OutboxEntity) return false
        return packetId == other.packetId
    }

    override fun hashCode(): Int = packetId.hashCode()
}

package mesh.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {

    // ── Contacts ───────────────────────────────────────────────────────────

    @Query("SELECT * FROM contacts")
    fun getAllContactsFlow(): Flow<List<ContactEntity>>

    @Query("SELECT * FROM contacts WHERE nodeId = :nodeId")
    suspend fun getContact(nodeId: String): ContactEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertContact(contact: ContactEntity)

    @Update
    suspend fun updateContact(contact: ContactEntity)

    // ── Sessions ───────────────────────────────────────────────────────────

    @Query("SELECT * FROM sessions WHERE nodeId = :nodeId")
    suspend fun getSession(nodeId: String): SessionEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: SessionEntity)

    // ── Messages ───────────────────────────────────────────────────────────

    @Query("SELECT * FROM messages WHERE convoId = :convoId ORDER BY timestamp ASC")
    fun getMessagesFlow(convoId: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("UPDATE messages SET status = :status WHERE id = :id")
    suspend fun updateMessageStatus(id: String, status: String)

    // ── Outbox ─────────────────────────────────────────────────────────────

    @Query("SELECT * FROM outbox WHERE status = 'PENDING' OR status = 'IN_FLIGHT'")
    suspend fun getPendingOutbox(): List<OutboxEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOutbox(outbox: OutboxEntity)

    @Delete
    suspend fun deleteOutbox(outbox: OutboxEntity)

    @Query("UPDATE outbox SET status = :status, retryCount = :retryCount, lastRetryTime = :lastRetryTime WHERE packetId = :packetId")
    suspend fun updateOutboxStatus(packetId: String, status: String, retryCount: Int, lastRetryTime: Long)
}

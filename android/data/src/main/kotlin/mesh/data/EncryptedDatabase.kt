package mesh.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.sqlcipher.database.SupportFactory
import net.sqlcipher.database.SQLiteDatabase

@Database(
    entities = [
        ContactEntity::class,
        SessionEntity::class,
        MessageEntity::class,
        OutboxEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class EncryptedDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao

    companion object {
        private const val DB_NAME = "mesh_messenger_secure.db"

        @Volatile
        private var INSTANCE: EncryptedDatabase? = null

        /**
         * Initialize the encrypted database.
         * The passphrase should be wrapped inside the Android Keystore,
         * or derived via PBKDF2/Argon2. For the scaffold, we pass the key as a chararray.
         */
        fun getInstance(context: Context, dbPassphrase: CharArray): EncryptedDatabase {
            return INSTANCE ?: synchronized(this) {
                // Initialize SQLCipher library binaries
                SQLiteDatabase.loadLibs(context)
                
                val factory = SupportFactory(SQLiteDatabase.getBytes(dbPassphrase))
                
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    EncryptedDatabase::class.java,
                    DB_NAME
                )
                    .openHelperFactory(factory)
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}

/**
 * @mesh/relay — PostgreSQL Database Setup
 *
 * Persists registered NodeIDs and E2EE prekey bundles.
 */

import pg from 'pg';

const { Pool } = pg;

// Configuration fallback to standard local postgres setup
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mesh_messenger';

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Perform database schema setup.
 * Executed on server startup.
 */
export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Registrations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        node_id VARCHAR(64) PRIMARY KEY,
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) NOT NULL
      );
    `);

    // 2. Prekey Bundles Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS prekeys (
        node_id VARCHAR(64) PRIMARY KEY REFERENCES registrations(node_id) ON DELETE CASCADE,
        bundle JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ PostgreSQL database schema initialized successfully');
  } catch (err: any) {
    console.error('❌ Failed to initialize PostgreSQL schema:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Register a NodeID.
 */
export async function registerNode(nodeId: string, ipAddress: string): Promise<void> {
  await pool.query(
    `INSERT INTO registrations (node_id, ip_address)
     VALUES ($1, $2)
     ON CONFLICT (node_id) DO UPDATE SET ip_address = $2, registered_at = CURRENT_TIMESTAMP`,
    [nodeId, ipAddress]
  );
}

/**
 * Check if a NodeID is registered.
 */
export async function isNodeRegistered(nodeId: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM registrations WHERE node_id = $1', [nodeId]);
  return res.rowCount !== null && res.rowCount > 0;
}

/**
 * Upload prekey bundle.
 */
export async function savePrekeys(nodeId: string, bundle: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO prekeys (node_id, bundle, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (node_id) DO UPDATE SET bundle = $2, updated_at = CURRENT_TIMESTAMP`,
    [nodeId, JSON.stringify(bundle)]
  );
}

/**
 * Fetch prekey bundle.
 */
export async function getPrekeys(nodeId: string): Promise<unknown | null> {
  const res = await pool.query('SELECT bundle FROM prekeys WHERE node_id = $1', [nodeId]);
  if (res.rows.length === 0) return null;
  return res.rows[0].bundle;
}

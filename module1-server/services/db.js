// Neon serverless PostgreSQL client.
// Connection is established lazily on first query — no overhead if auth
// is not used (e.g. the DATABASE_URL placeholder hasn't been set yet).
//
// Set DATABASE_URL in .env to your Neon connection string:
//   postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

const { neon } = require("@neondatabase/serverless");

let _sql = null;

function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url || url === "YOUR_NEON_DATABASE_URL_HERE") {
    throw new Error(
      "[db] DATABASE_URL is not set. Add your Neon connection string to .env to enable auth."
    );
  }
  _sql = neon(url);
  return _sql;
}

/**
 * Run all schema migrations idempotently.
 * Called once on server startup. Safe to call repeatedly.
 */
async function runMigrations() {
  try {
    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        google_id     TEXT UNIQUE NOT NULL,
        email         TEXT UNIQUE NOT NULL,
        name          TEXT NOT NULL,
        picture       TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        user_id    INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;

    // Index for fast session lookups
    await sql`
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)
    `;

    console.log("[db] Migrations complete — users + sessions tables ready.");
  } catch (err) {
    console.warn(`[db] Migrations skipped/notice: ${err.message}`);
  }
}

/**
 * Query wrapper — returns rows array.
 * Usage: await query`SELECT * FROM users WHERE id = ${id}`
 */
function query(...args) {
  return getSql()(...args);
}

module.exports = { query, runMigrations, getSql };

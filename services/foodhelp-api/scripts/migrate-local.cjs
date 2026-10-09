const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

function localDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  let databaseHost = '';
  try { databaseHost = new URL(connectionString).hostname.toLowerCase(); } catch { /* Invalid URLs are rejected below. */ }
  const isLocal = localDatabaseUrl(connectionString);
  const isNeon = databaseHost.endsWith('.neon.tech');
  const localAllowed = isLocal && process.env.FOODHELP_ALLOW_LOCAL_MIGRATIONS === '1';
  const neonAllowed = isNeon && process.env.FOODHELP_ALLOW_NEON_MIGRATIONS === '1';
  if (!localAllowed && !neonAllowed) {
    throw new Error('Migrations require the matching explicit opt-in and a loopback or Neon DATABASE_URL.');
  }

  const client = new Client({
    connectionString,
    ssl: isNeon ? { rejectUnauthorized: true } : false,
  });
  try {
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS foodhelp');
    await client.query(`CREATE TABLE IF NOT EXISTS foodhelp.schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const directory = path.resolve(__dirname, '../src/db/migrations');
    const migrations = fs.readdirSync(directory).filter((name) => name.endsWith('.sql')).sort();
    for (const name of migrations) {
      const applied = await client.query('SELECT 1 FROM foodhelp.schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;

      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(directory, name), 'utf8'));
        await client.query('INSERT INTO foodhelp.schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.log(`Applied migration: ${name}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

migrate().catch((error) => {
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : 'UNKNOWN';
  console.error(`Migration failed (${code}). Verify the explicit migration opt-in and database configuration.`);
  process.exitCode = 1;
});
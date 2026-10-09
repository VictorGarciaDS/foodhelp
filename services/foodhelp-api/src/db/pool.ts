import { Pool } from 'pg';
import { config } from '../config';

let pool: Pool | undefined;
export function getPool(): Pool {
  if (!config.DATABASE_URL) throw new Error('DATABASE_UNAVAILABLE');
  pool ??= new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: true }, max: 5, connectionTimeoutMillis: 5000 });
  return pool;
}

export async function databaseReady(): Promise<boolean> {
  if (!config.DATABASE_URL) return false;
  try { await getPool().query('SELECT 1'); return true; } catch { return false; }
}
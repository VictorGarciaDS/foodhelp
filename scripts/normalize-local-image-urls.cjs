const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const publicRoot = path.resolve(__dirname, '..', 'services', 'foodhelp-web', 'public');
const origin = 'https://foodhelp-qc7m.onrender.com';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    const updates = [];
    const skipped = [];
    for (const table of ['recipes', 'foods']) {
      const { rows } = await client.query(`SELECT id, name, image_url FROM foodhelp.${table} WHERE image_url IS NOT NULL`);
      for (const row of rows) {
        if (!row.image_url.startsWith(`${origin}/`)) continue;
        const url = new URL(row.image_url);
        if (url.origin !== origin || !url.pathname.startsWith('/images/')) {
          skipped.push({ table, name: row.name, reason: 'No es una imagen local' });
          continue;
        }
        const target = path.resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
        if (!target.startsWith(`${publicRoot}${path.sep}`) || !(await fs.stat(target).catch(() => null))?.isFile()) {
          skipped.push({ table, name: row.name, reason: 'Archivo local no encontrado' });
          continue;
        }
        updates.push({ table, id: row.id, name: row.name, before: row.image_url, after: `${url.pathname}${url.search}${url.hash}` });
      }
    }
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', updates: updates.length, skipped }, null, 2));
    if (!process.argv.includes('--apply') || !updates.length) return;
    const backup = path.join(os.tmpdir(), `foodhelp-image-urls-${Date.now()}.json`);
    await fs.writeFile(backup, JSON.stringify(updates, null, 2), { mode: 0o600 });
    await client.query('BEGIN');
    try {
      for (const update of updates) {
        const result = await client.query(`UPDATE foodhelp.${update.table} SET image_url = $1 WHERE id = $2 AND image_url = $3`, [update.after, update.id, update.before]);
        if (result.rowCount !== 1) throw new Error(`La imagen cambio durante la actualizacion: ${update.name}`);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(JSON.stringify({ updated: updates.length, backup }));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
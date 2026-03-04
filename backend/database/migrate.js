require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = require('../db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const dir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of files) {
      const existing = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [fileName]
      );
      if (existing.rows.length) {
        console.log(`Skipping ${fileName} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, fileName), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations(name) VALUES($1)', [fileName]);
      await client.query('COMMIT');
      console.log(`Applied ${fileName}`);
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Ignore rollback errors when no transaction is active.
    }
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();

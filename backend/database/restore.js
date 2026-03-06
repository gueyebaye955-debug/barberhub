/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function run() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('Usage: node database/restore.js <path-to-backup.dump>');
    process.exit(1);
  }

  const inputFile = path.isAbsolute(inputArg) ? inputArg : path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(inputFile)) {
    console.error(`Backup file not found: ${inputFile}`);
    process.exit(1);
  }

  const env = { ...process.env };
  const args = ['--clean', '--if-exists', '--no-owner', '--no-privileges'];

  if (process.env.DATABASE_URL) {
    args.push('--dbname', process.env.DATABASE_URL);
  } else {
    args.push('--host', process.env.DB_HOST || 'localhost');
    args.push('--port', String(process.env.DB_PORT || 5432));
    args.push('--username', process.env.DB_USER || 'postgres');
    args.push('--dbname', process.env.DB_NAME || 'barberhub');
    if (process.env.DB_PASSWORD) {
      env.PGPASSWORD = process.env.DB_PASSWORD;
    }
  }

  args.push(inputFile);
  console.log(`Restoring backup: ${inputFile}`);
  const result = spawnSync('pg_restore', args, {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  console.log('Restore complete.');
}

run();

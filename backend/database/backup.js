/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function run() {
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const outputFile = path.join(backupDir, `jotma-${timestamp()}.dump`);

  const args = ['--format=custom', '--no-owner', '--no-privileges', '--file', outputFile];
  const env = { ...process.env };

  if (process.env.DATABASE_URL) {
    args.push(process.env.DATABASE_URL);
  } else {
    args.push('--host', process.env.DB_HOST || 'localhost');
    args.push('--port', String(process.env.DB_PORT || 5432));
    args.push('--username', process.env.DB_USER || 'postgres');
    args.push(process.env.DB_NAME || 'barberhub');
    if (process.env.DB_PASSWORD) {
      env.PGPASSWORD = process.env.DB_PASSWORD;
    }
  }

  console.log(`Creating backup: ${outputFile}`);
  const result = spawnSync('pg_dump', args, {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log('Backup complete.');
}

run();

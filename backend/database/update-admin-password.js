require('dotenv').config();
const pool = require('../db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE users SET password=$1 WHERE email='admin@demo.com'",
      ['$2a$10$MXadMmjl2aMOfEhmSzzUxO9QZBBbuUK4cIUy50drbQdz2dNkfn7nO']
    );
    console.log('Admin password updated');
  } finally {
    client.release();
    await pool.end();
  }
}

run();

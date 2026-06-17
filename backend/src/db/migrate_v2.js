const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema_v2.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✓ V2 Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error('V2 Migration failed:', e.message); process.exit(1); });

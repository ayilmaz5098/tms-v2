const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema_v3.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✓ V3 Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(e => { console.error('V3 Migration failed:', e.message); process.exit(1); });

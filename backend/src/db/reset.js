const pool = require('./pool');

async function reset() {
  const client = await pool.connect();
  console.log('Resetting ALL data including projects...');
  await client.query('DELETE FROM motor_parts');
  await client.query('DELETE FROM motors');
  await client.query('DELETE FROM notifications');
  await client.query('DELETE FROM oot_records');
  await client.query('DELETE FROM shift_handovers');
  await client.query('DELETE FROM audit_log');
  await client.query('DELETE FROM measurements');
  await client.query('DELETE FROM photos');
  await client.query('DELETE FROM step_states');
  await client.query('DELETE FROM rotors');
  await client.query('DELETE FROM projects');
  client.release();
  console.log('✓ All data cleared — projects, rotors, steps, measurements, motors');
  process.exit(0);
}

reset().catch(e => { console.error('Reset failed:', e.message); process.exit(1); });

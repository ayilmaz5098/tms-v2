/**
 * TMS User Management Script
 * Usage:
 *   node src/db/manage_users.js list
 *   node src/db/manage_users.js reset-password email@tms.com newpassword
 *   node src/db/manage_users.js add "Ad Soyad" email@tms.com password role
 *   (role = admin | operator | qc)
 */
const bcrypt = require('bcryptjs');
const pool   = require('./pool');

const [,, cmd, ...args] = process.argv;

async function run() {
  const client = await pool.connect();
  try {
    if (cmd === 'list') {
      const { rows } = await client.query(
        'SELECT id, name, email, role, active, last_login FROM users ORDER BY id'
      );
      console.log('\n── TMS USERS ─────────────────────────────────────────');
      rows.forEach(u => {
        const last = u.last_login ? new Date(u.last_login).toLocaleString('tr-TR') : 'Never';
        console.log(`[${u.id}] ${u.name.padEnd(20)} ${u.email.padEnd(25)} ${u.role.padEnd(10)} ${u.active ? 'Active' : 'INACTIVE'}  Last: ${last}`);
      });
      console.log('──────────────────────────────────────────────────────\n');

    } else if (cmd === 'reset-password') {
      const [email, newPw] = args;
      if (!email || !newPw) { console.error('Usage: reset-password email password'); process.exit(1); }
      if (newPw.length < 6) { console.error('Password must be at least 6 chars'); process.exit(1); }
      const hash = await bcrypt.hash(newPw, 10);
      const { rowCount } = await client.query(
        'UPDATE users SET password=$1 WHERE email=$2', [hash, email]
      );
      if (rowCount === 0) console.error(`✗ No user found with email: ${email}`);
      else console.log(`✓ Password updated for ${email}`);

    } else if (cmd === 'add') {
      const [name, email, pw, role='operator'] = args;
      if (!name || !email || !pw) { console.error('Usage: add "Name" email password [role]'); process.exit(1); }
      const validRoles = ['admin','operator','qc'];
      if (!validRoles.includes(role)) { console.error(`Role must be one of: ${validRoles.join(', ')}`); process.exit(1); }
      const hash = await bcrypt.hash(pw, 10);
      const { rows } = await client.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING id',
        [name, email, hash, role]
      );
      if (rows.length === 0) console.error(`✗ Email already exists: ${email}`);
      else console.log(`✓ User created: [${rows[0].id}] ${name} <${email}> role=${role}`);

    } else if (cmd === 'activate') {
      const [email] = args;
      const { rowCount } = await client.query('UPDATE users SET active=true WHERE email=$1', [email]);
      if (rowCount === 0) console.error(`✗ No user: ${email}`);
      else console.log(`✓ Activated: ${email}`);

    } else {
      console.log(`
TMS User Management
  node src/db/manage_users.js list
  node src/db/manage_users.js reset-password <email> <newpassword>
  node src/db/manage_users.js add "<Full Name>" <email> <password> <role>
  node src/db/manage_users.js activate <email>
      `);
    }
  } finally {
    client.release();
    process.exit(0);
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

const bcrypt = require('bcryptjs');
const pool   = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    // Users
    const pw = await bcrypt.hash('tms2026', 10);
    await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Uğur Uludağ',    'admin@tms.com',     $1, 'admin'),
        ('Mücahit Yeter',  'operator@tms.com',  $1, 'operator'),
        ('Metehan Teker',  'operator2@tms.com', $1, 'operator'),
        ('Dimitcon Soğon', 'qc@tms.com',        $1, 'qc'),
        ('Şebnem Hekani',  'qc2@tms.com',       $1, 'qc')
      ON CONFLICT (email) DO NOTHING
    `, [pw]);
    console.log('✓ Users seeded');

    // Clean up any old rotor_type values with wrong format
    await client.query("UPDATE rotors SET rotor_type='DKCBZ 0210-4G' WHERE rotor_type ILIKE '%4GG%' OR rotor_type='DKCBZ 0210-4'");
    // Fix wrong shaft numbers (25-570XX should be 25-580XX)
    await client.query("UPDATE rotors SET shaft_no = REPLACE(shaft_no, '25-570', '25-580') WHERE shaft_no LIKE '25-570%'");
    // Remove SAM prefix from serial_no — use shaft_no format
    await client.query("UPDATE rotors SET serial_no = shaft_no WHERE serial_no LIKE 'SAM-%'");
    console.log('✓ rotor_type values normalized to DKCBZ 0210-4G');

    // Project
    const { rows } = await client.query(`
      INSERT INTO projects (name, code, description)
      VALUES ('Samsun Projesi', '2/BOZANKAYA (SAMSUN)', 'DKCBZ 0210-4G — VEM Sachsenwerk GmbH')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    const projId = rows[0]?.id;

    if (projId) {
      const adminRes = await client.query(`SELECT id FROM users WHERE email='admin@tms.com'`);
      const adminId  = adminRes.rows[0].id;

      // 60 rotors — all not_started, shaft numbers 25-58001 to 25-58060
      const values = Array.from({ length: 60 }, (_, i) => {
        const n     = i + 1;
        const sn    = `25-${58000 + n}`; // Use shaft number as serial number (no SAM prefix)
        const shaft = `25-${58000 + n}`; // 25-58001 ... 25-58060
        return `(${projId}, '${sn}', '${shaft}', 'DKCBZ 0210-4G', 'not_started', ${adminId})`;
      });

      await client.query(`
        INSERT INTO rotors (project_id, serial_no, shaft_no, rotor_type, status, created_by)
        VALUES ${values.join(',')}
        ON CONFLICT (serial_no) DO UPDATE SET
          shaft_no   = EXCLUDED.shaft_no,
          rotor_type = EXCLUDED.rotor_type,
          status     = 'not_started'
      `);
      console.log('✓ 60 rotors seeded (all not_started, shaft: 25-58001 to 25-58060)');

      // Clear all step states and measurements for fresh start
      await client.query('DELETE FROM step_states WHERE rotor_id IN (SELECT id FROM rotors WHERE project_id=$1)', [projId]);
      console.log('✓ Step states cleared');
    }

    // Audit entry
    await client.query(
      'INSERT INTO audit_log (user_name, action, detail) VALUES ($1,$2,$3)',
      ['SISTEM', 'SEED', 'Veritabanı sıfırlandı — 60 rotor temiz başlangıç']
    );
    console.log('✓ Seed complete — database ready for production testing');
  } finally {
    client.release();
  }
  process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });

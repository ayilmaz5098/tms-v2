const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/rotors?projectId=&status=&search=
router.get('/', auth, async (req, res) => {
  const { projectId, status, search } = req.query;
  let q = `SELECT r.*, p.name as project_name, p.code as project_code,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM step_states ss WHERE ss.rotor_id=r.id AND ss.status='completed')::int as completed_steps
           FROM rotors r
           LEFT JOIN projects p ON p.id = r.project_id
           LEFT JOIN users u ON u.id = r.created_by
           WHERE 1=1`;
  const params = [];
  if (projectId) { params.push(projectId); q += ` AND r.project_id = $${params.length}`; }
  if (status)    { params.push(status);    q += ` AND r.status = $${params.length}`; }
  if (search)    { params.push(`%${search}%`); q += ` AND (r.serial_no ILIKE $${params.length} OR r.shaft_no ILIKE $${params.length})`; }
  q += ' ORDER BY r.id ASC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// GET /api/rotors/:id
router.get('/:id', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, p.name as project_name, p.code as project_code
     FROM rotors r LEFT JOIN projects p ON p.id = r.project_id
     WHERE r.id = $1`, [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /api/rotors — admin/operator, supports batch
router.post('/', auth, requireRole('admin', 'operator'), async (req, res) => {
  const { projectId, serialNo, shaftNo, rotorType, batch = 1 } = req.body;
  if (!projectId || !serialNo) return res.status(400).json({ error: 'projectId and serialNo required' });

  const created = [];
  const baseNum = parseInt(serialNo.split('-').pop()) || 1;
  const basePrefix = serialNo.slice(0, serialNo.lastIndexOf('-') + 1);

  for (let i = 0; i < batch; i++) {
    const sn    = batch > 1 ? `${basePrefix}${String(baseNum + i).padStart(4,'0')}` : serialNo;
    const shaft = batch > 1 ? `25-${57000 + baseNum + i}` : shaftNo;
    try {
      const { rows } = await pool.query(
        `INSERT INTO rotors (project_id, serial_no, shaft_no, rotor_type, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [projectId, sn, shaft, rotorType || 'DKCBZ 0210-4', req.user.id]
      );
      created.push(rows[0]);
    } catch (e) {
      if (e.code !== '23505') throw e;
    }
  }

  await pool.query(
    'INSERT INTO audit_log (user_id,user_name,action,detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'YENİ_ROTOR', `${created.length} rotor eklendi`]
  );
  res.status(201).json(batch === 1 ? created[0] : created);
});

// PATCH /api/rotors/:id — update status/notes
router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { status, notes } = req.body;
  const { rows } = await pool.query(
    'UPDATE rotors SET status = COALESCE($1, status), notes = COALESCE($2, notes) WHERE id = $3 RETURNING *',
    [status, notes, req.params.id]
  );
  res.json(rows[0]);
});

// GET /api/rotors/:id/steps — all step states for this rotor
router.get('/:id/steps', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ss.*,
       su.name as started_by_name, cu.name as completed_by_name, qu.name as qc_by_name,
       EXTRACT(EPOCH FROM (COALESCE(ss.completed_at, NOW()) - ss.started_at))/60 AS elapsed_min
     FROM step_states ss
     LEFT JOIN users su ON su.id = ss.started_by
     LEFT JOIN users cu ON cu.id = ss.completed_by
     LEFT JOIN users qu ON qu.id = ss.qc_by
     WHERE ss.rotor_id = $1
     ORDER BY ss.section, ss.step_number`,
    [req.params.id]
  );
  const stepIds = rows.map(r => r.id);
  let meas = [];
  if (stepIds.length) {
    const { rows: measRows } = await pool.query(
      `SELECT m.*, u.name as recorded_by_name
       FROM measurements m
       LEFT JOIN users u ON u.id = m.recorded_by
       WHERE m.step_state_id = ANY($1)
       ORDER BY m.step_state_id, m.meas_index`,
      [stepIds]
    );
    meas = measRows;
  }
  const measByStep = {};
  meas.forEach(m => {
    if (!measByStep[m.step_state_id]) measByStep[m.step_state_id] = {};
    measByStep[m.step_state_id][m.meas_index] = m;
  });
  res.json(rows.map(r => ({ ...r, measurements: measByStep[r.id] || {} })));
});

// GET /api/rotors/:id/parts — load saved assembly parts
router.get('/:id/parts', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM rotor_parts WHERE rotor_id=$1', [req.params.id]
  );
  res.json(rows[0] || {});
});

// POST /api/rotors/:id/parts/save — partial save with per-field timestamps
router.post('/:id/parts/save', auth, requireRole('admin','operator','qc' ), async (req, res) => {
  try {
  const b = req.body;
  // Accept both snake_case and camelCase
  const fields = {
    shaft_sn:           b.shaft_sn           || b.shaftSn           || null,
    stator_sn:          b.stator_sn          || b.statorSn          || null,
    bearing_bracket_sn: b.bearing_bracket_sn || b.bearingBracketSn  || null,
    bearing_de_sn:      b.bearing_de_sn      || b.bearingDeSn       || null,
    bearing_nde_sn:     b.bearing_nde_sn     || b.bearingNdeSn      || null,
    tooth_wheel_sn:     b.tooth_wheel_sn     || b.toothWheelSn      || null,
    coupling_sn:        b.coupling_sn        || b.couplingSn        || null,
    fan_sn:             b.fan_sn             || b.fanSn             || null,
    kaplin_sn:          b.kaplin_sn          || b.kaplinSn          || null,
    enkoder_sn:         b.enkoder_sn         || b.enkoderSn         || null,
    assembly_note:      b.assembly_note      || b.assemblyNote      || null,
  };

  const now = new Date().toISOString();

  // Fetch existing row to merge timestamps
  const { rows: existing } = await pool.query(
    'SELECT field_timestamps FROM rotor_parts WHERE rotor_id=$1', [req.params.id]
  );
  const existingTs = existing[0]?.field_timestamps || {};

  // Only update timestamp for fields that have a non-empty value being saved NOW
  const newTs = { ...existingTs };
  Object.entries(fields).forEach(([key, val]) => {
    if (val && val.toString().trim()) newTs[key] = now;
  });

  const { rows } = await pool.query(
    `INSERT INTO rotor_parts
       (rotor_id, shaft_sn, stator_sn, bearing_bracket_sn, bearing_de_sn, bearing_nde_sn,
        tooth_wheel_sn, coupling_sn, fan_sn, kaplin_sn, enkoder_sn, assembly_note,
        field_timestamps, last_updated_by, last_updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,NOW())
     ON CONFLICT (rotor_id) DO UPDATE SET
       shaft_sn           = COALESCE(NULLIF($2,''),  rotor_parts.shaft_sn),
       stator_sn          = COALESCE(NULLIF($3,''),  rotor_parts.stator_sn),
       bearing_bracket_sn = COALESCE(NULLIF($4,''),  rotor_parts.bearing_bracket_sn),
       bearing_de_sn      = COALESCE(NULLIF($5,''),  rotor_parts.bearing_de_sn),
       bearing_nde_sn     = COALESCE(NULLIF($6,''),  rotor_parts.bearing_nde_sn),
       tooth_wheel_sn     = COALESCE(NULLIF($7,''),  rotor_parts.tooth_wheel_sn),
       coupling_sn        = COALESCE(NULLIF($8,''),  rotor_parts.coupling_sn),
       fan_sn             = COALESCE(NULLIF($9,''),  rotor_parts.fan_sn),
       kaplin_sn          = COALESCE(NULLIF($10,''), rotor_parts.kaplin_sn),
       enkoder_sn         = COALESCE(NULLIF($11,''), rotor_parts.enkoder_sn),
       assembly_note      = COALESCE(NULLIF($12,''), rotor_parts.assembly_note),
       field_timestamps   = $13::jsonb,
       last_updated_by    = $14,
       last_updated_at    = NOW()
     RETURNING *`,
    [req.params.id,
     fields.shaft_sn, fields.stator_sn, fields.bearing_bracket_sn,
     fields.bearing_de_sn, fields.bearing_nde_sn, fields.tooth_wheel_sn,
     fields.coupling_sn, fields.fan_sn, fields.kaplin_sn,
     fields.enkoder_sn, fields.assembly_note,
     JSON.stringify(newTs), req.user.id]
  );
  res.json(rows[0]);
  } catch(e) { console.error('parts/save error:', e.message); res.status(500).json({ error: e.message }); }
});

// POST /api/rotors/:id/assemble — finalize rotor
router.post('/:id/assemble', auth, requireRole('admin','operator', 'qc'), async (req, res) => {
  const { shaftSn, statorSn, bearingBracketSn, bearingDeSn, bearingNdeSn, toothWheelSn, couplingSn, fanSn, kaplinSn, enkoderSn, note } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO rotor_parts (rotor_id, shaft_sn, stator_sn, bearing_bracket_sn,
         bearing_de_sn, bearing_nde_sn, tooth_wheel_sn, coupling_sn, assembly_note, assembled_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (rotor_id) DO UPDATE SET
         shaft_sn=EXCLUDED.shaft_sn, stator_sn=EXCLUDED.stator_sn,
         assembled_by=EXCLUDED.assembled_by, assembled_at=NOW()`,
      [req.params.id, shaftSn, statorSn, bearingBracketSn, bearingDeSn, bearingNdeSn, toothWheelSn, couplingSn, note, req.user.id]
    );
    const { rows } = await client.query(
      'UPDATE rotors SET status=$1, assembled_at=NOW() WHERE id=$2 RETURNING *',
      ['assembled', req.params.id]
    );
    const rotor = rows[0];

    const motorSn = rotor.shaft_no || rotor.serial_no;
    const { rows: existingMotors } = await client.query(
      'SELECT id FROM motors WHERE motor_sn=$1', [motorSn]
    );
    let motorId;
    if (existingMotors.length === 0) {
      const { rows: newMotor } = await client.query(
        `INSERT INTO motors (project_id, motor_sn, rotor_id, notes, created_by, status)
         VALUES ($1,$2,$3,$4,$5,'assembly_pending') RETURNING *`,
        [rotor.project_id, motorSn, rotor.id, `Rotor ${motorSn} montajından oluşturuldu`, req.user.id]
      );
      motorId = newMotor[0].id;
    } else {
      motorId = existingMotors[0].id;
      await client.query('UPDATE motors SET rotor_id=$1 WHERE id=$2', [rotor.id, motorId]);
    }

 const PART_MAP = [
      ['Stator Seri Numarası',                statorSn],
      ['N-Side Kapak Seri Numarası',          bearingBracketSn],
      ['D-Side Kapak Seri Numarası',          bearingDeSn],
      ['Rotor (Şaft) Seri Numarası',          shaftSn],
      ['N-Side Rulman Seri Numarası',         bearingNdeSn],
      ['D-Side Rulman Seri Numarası',         toothWheelSn],
      ['Fren Diski Seri Numarası',            couplingSn],
      ['Fan Seri Numarası',                   fanSn],
      ['Kaplin Seri Numarası',                kaplinSn],
      ['Enkoder Okuyucu Dişli Seri Numarası', enkoderSn],
    ];
    await client.query('DELETE FROM motor_parts WHERE motor_id=$1', [motorId]);
    for (const [partName, serial] of PART_MAP) {
      if (serial) {
        await client.query(
          'INSERT INTO motor_parts (motor_id, part_name, serial_number, entered_by) VALUES ($1,$2,$3,$4)',
          [motorId, partName, serial, req.user.id]
        );
      }
    }

    await client.query(
      'INSERT INTO audit_log (user_id,user_name,action,rotor_id,rotor_sn,detail) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, req.user.name, 'MONTAJ', req.params.id, rotor.serial_no, `Şaft: ${motorSn} → Motor oluşturuldu`]
    );
    await client.query('COMMIT');
    res.json(rotor);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

module.exports = router;

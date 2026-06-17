const router = require('express').Router();
const pool   = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

// Helper: get or create step_state
async function getOrCreate(client, rotorId, section, stepNum) {
  const { rows } = await client.query(
    `INSERT INTO step_states (rotor_id, section, step_number)
     VALUES ($1,$2,$3) ON CONFLICT (rotor_id, section, step_number) DO NOTHING
     RETURNING *`, [rotorId, section, stepNum]
  );
  if (rows[0]) return rows[0];
  const { rows: [existing] } = await client.query(
    'SELECT * FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=$3',
    [rotorId, section, stepNum]
  );
  return existing;
}

async function addAudit(client, userId, userName, action, rotorId, rotorSn, section, step, detail) {
  await client.query(
    'INSERT INTO audit_log (user_id,user_name,action,rotor_id,rotor_sn,section,step_number,detail) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [userId, userName, action, rotorId, rotorSn, section, step, detail]
  );
}

async function addNotif(client, type, message, rotorId, targetRole) {
  await client.query(
    'INSERT INTO notifications (type, message, rotor_id, target_role) VALUES ($1,$2,$3,$4)',
    [type, message, rotorId, targetRole]
  );
}

async function getRotor(client, rotorId) {
  const { rows: [r] } = await client.query('SELECT * FROM rotors WHERE id=$1', [rotorId]);
  return r;
}

async function updateRotorStatus(client, rotorId) {
  const { rows } = await client.query(
    'SELECT status FROM step_states WHERE rotor_id=$1', [rotorId]
  );
  const statuses = rows.map(r => r.status);
  const TOTAL_STEPS = 12; // 6 brazing_oncesi + 4 brazing_sonrasi + 2 boyama
  const completedCount = statuses.filter(s => s === 'completed').length;

  let rotorStatus = 'not_started';
  if (statuses.some(s => s === 'in_progress' || s === 'paused')) {
    rotorStatus = 'in_progress';
  } else if (statuses.some(s => s === 'qc_pending')) {
    rotorStatus = 'qc_pending';
  } else if (completedCount > 0 && completedCount < TOTAL_STEPS) {
    rotorStatus = 'in_progress'; // some done but not all = still in progress
  } else if (completedCount === TOTAL_STEPS) {
    rotorStatus = 'completed'; // all 12 done = truly completed
  }
  // else: no steps started at all = not_started (default)

  await client.query('UPDATE rotors SET status=$1 WHERE id=$2', [rotorStatus, rotorId]);
  return rotorStatus;
}

// POST /api/steps/:rotorId/:section/:step/start
router.post('/:rotorId/:section/:step/start', auth, async (req, res) => {
  const { rotorId, section, step } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Block sections based on previous section completion (admin bypasses)
    if (req.user.role !== 'admin') {
      if (section === 'brazing_sonrasi') {
        const { rows: [s] } = await client.query(
          `SELECT COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done
           FROM step_states WHERE rotor_id=$1 AND section='brazing_oncesi'`, [rotorId]
        );
        if (parseInt(s.total) < 6 || parseInt(s.done) < 6) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Brazing Öncesi Adımlar tamamlanmadan Brazing Sonrası Adımlar başlatılamaz.' });
        }
      }
  if (section === 'boyama') {
  const { rows: [sertlik] } = await client.query(
    'SELECT status FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=1',
    [rotorId, 'brazing_sonrasi']
  );
  if (!sertlik || sertlik.status !== 'completed') {
    await client.query('ROLLBACK');
    return res.status(403).json({ error: 'Sertlik Olcumu tamamlanmadan Yuzey Hazirligi/Boyama baslatılamaz.' });
  }
}
    }

    const ss = await getOrCreate(client, rotorId, section, parseInt(step));
    if (ss.status === 'in_progress') return res.status(409).json({ error: 'Already in progress' });

    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='in_progress', started_by=$1, started_at=NOW()
       WHERE id=$2 RETURNING *`,
      [req.user.id, ss.id]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'BAŞLADI', rotorId, rotor?.serial_no, section, step, `${req.user.name} başladı`);
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/pause
router.post('/:rotorId/:section/:step/pause', auth, async (req, res) => {
  const { rotorId, section, step } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='paused', paused_at=NOW()
       WHERE rotor_id=$1 AND section=$2 AND step_number=$3 RETURNING *`,
      [rotorId, section, parseInt(step)]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'DURAKLATTI', rotorId, rotor?.serial_no, section, step, `Vardiya bırakıldı`);
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/resume
router.post('/:rotorId/:section/:step/resume', auth, async (req, res) => {
  const { rotorId, section, step } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='in_progress', started_by=$1, started_at=NOW(), paused_at=NULL
       WHERE rotor_id=$2 AND section=$3 AND step_number=$4 RETURNING *`,
      [req.user.id, rotorId, section, parseInt(step)]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'DEVAM', rotorId, rotor?.serial_no, section, step, `${req.user.name} devraldı`);
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/request-qc
router.post('/:rotorId/:section/:step/request-qc', auth, async (req, res) => {
  const { rotorId, section, step } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='qc_pending'
       WHERE rotor_id=$1 AND section=$2 AND step_number=$3 RETURNING *`,
      [rotorId, section, parseInt(step)]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'QC_İSTEK', rotorId, rotor?.serial_no, section, step, `${req.user.name} KK onayı istedi`);
    await addNotif(client, 'QC_BEKLIYOR', `${rotor?.serial_no} — ${section} Adım ${step}: KK onayı bekleniyor`, rotorId, 'qc');
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/complete
router.post('/:rotorId/:section/:step/complete', auth, async (req, res) => {
  const { rotorId, section, step } = req.params;
  const { note } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ss] } = await client.query(
      'SELECT * FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=$3',
      [rotorId, section, parseInt(step)]
    );
    if (!ss) return res.status(404).json({ error: 'Step not found' });
    const durMin = ss.started_at
      ? Math.round((Date.now() - new Date(ss.started_at).getTime()) / 60000)
      : null;
    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='completed', completed_by=$1, completed_at=NOW(),
         duration_min=$2, note=COALESCE($3, note)
       WHERE id=$4 RETURNING *`,
      [req.user.id, durMin, note, ss.id]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'TAMAMLADI', rotorId, rotor?.serial_no, section, step,
      `${req.user.name} — ${durMin ? Math.floor(durMin/60)+'s '+(durMin%60)+'dk' : '—'}${note ? ' — ' + note : ''}`);
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/qc-approve
router.post('/:rotorId/:section/:step/qc-approve', auth, requireRole('admin','qc'), async (req, res) => {
  const { rotorId, section, step } = req.params;
  const { note } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ss] } = await client.query(
      'SELECT * FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=$3',
      [rotorId, section, parseInt(step)]
    );
    const durMin = ss?.started_at ? Math.round((Date.now() - new Date(ss.started_at).getTime()) / 60000) : null;
    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='completed', qc_by=$1, qc_at=NOW(),
         completed_at=NOW(), duration_min=$2, note=COALESCE($3, note)
       WHERE rotor_id=$4 AND section=$5 AND step_number=$6 RETURNING *`,
      [req.user.id, durMin, note, rotorId, section, parseInt(step)]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'QC_ONAY', rotorId, rotor?.serial_no, section, step, `${req.user.name} onayladı`);
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/qc-reject
router.post('/:rotorId/:section/:step/qc-reject', auth, requireRole('admin','qc'), async (req, res) => {
  const { rotorId, section, step } = req.params;
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'Reject reason required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [updated] } = await client.query(
      `UPDATE step_states SET status='rejected', rejected=true, reject_note=$1, qc_by=$2, qc_at=NOW()
       WHERE rotor_id=$3 AND section=$4 AND step_number=$5 RETURNING *`,
      [note, req.user.id, rotorId, section, parseInt(step)]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'QC_RET', rotorId, rotor?.serial_no, section, step, `Red: ${note}`);
    await addNotif(client, 'QC_RET', `${rotor?.serial_no} — Adım ${step} reddedildi: ${note}`, rotorId, 'operator');
    await client.query('COMMIT');
    res.json(updated);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/rework  — admin only
router.post('/:rotorId/:section/:step/rework', auth, requireRole('admin'), async (req, res) => {
  const { rotorId, section, step } = req.params;
  const stepNum = parseInt(step);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Reset ONLY this specific step (not subsequent steps)
    await client.query(
      `UPDATE step_states SET status='not_started', started_by=NULL, started_at=NULL,
         completed_by=NULL, completed_at=NULL, duration_min=NULL, qc_by=NULL, qc_at=NULL,
         note=NULL, oot=false, oot_reason=NULL, rejected=false, reject_note=NULL, paused_at=NULL
       WHERE rotor_id=$1 AND section=$2 AND step_number=$3`,
      [rotorId, section, stepNum]
    );
    // Delete measurements for ONLY this step
    await client.query(
      `DELETE FROM measurements WHERE step_state_id IN (
         SELECT id FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=$3
       )`, [rotorId, section, stepNum]
    );
    const rotor = await getRotor(client, rotorId);
    await updateRotorStatus(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'REWORK', rotorId, rotor?.serial_no, section, step, `Adım ${stepNum}+ sıfırlandı`);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/measurements
router.post('/:rotorId/:section/:step/measurements', auth, async (req, res) => {
  const { rotorId, section, step } = req.params;
  const { measurements, equipment } = req.body; // [{index, label, nominal, tolPlus, tolMinus, value, unit, isMin}]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ss] } = await client.query(
      'SELECT id FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=$3',
      [rotorId, section, parseInt(step)]
    );
    if (!ss) return res.status(404).json({ error: 'Step not found' });

    const saved = [];
    let hasOOT = false;
    const ootDetails = [];

    for (const m of measurements) {
      const ok = m.isMin ? m.value >= m.nominal : (m.value <= m.nominal + m.tolPlus && m.value >= m.nominal - m.tolMinus);
      if (!ok) { hasOOT = true; ootDetails.push(`${m.label}: ${m.value}${m.unit}`); }
      const { rows: [mrow] } = await client.query(
        `INSERT INTO measurements (step_state_id, meas_index, field_label, nominal, tol_plus, tol_minus,
           actual_value, unit, in_tolerance, is_min_check, equipment, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (step_state_id, meas_index) DO UPDATE SET
           actual_value=EXCLUDED.actual_value, in_tolerance=EXCLUDED.in_tolerance,
           equipment=EXCLUDED.equipment, recorded_by=EXCLUDED.recorded_by, recorded_at=NOW()
         RETURNING *`,
        [ss.id, m.index, m.label, m.nominal, m.tolPlus, m.tolMinus, m.value, m.unit, ok, m.isMin || false, equipment, req.user.id]
      );
      saved.push(mrow);
    }

    if (hasOOT) {
      await client.query(
        `UPDATE step_states SET oot=true, oot_reason=$1 WHERE id=$2`,
        [ootDetails.join('; '), ss.id]
      );
      const rotor = await getRotor(client, rotorId);
      await client.query(
        `INSERT INTO oot_records (rotor_id, step_state_id, section, step_number, details, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [rotorId, ss.id, section, parseInt(step), ootDetails.join('; '), req.user.id]
      );
      await addNotif(client, 'OOT', `${rotor?.serial_no} — ${section} Adım ${step}: Tolerans dışı ölçüm`, rotorId, 'qc');
    }

    const rotor = await getRotor(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'ÖLÇÜM', rotorId, rotor?.serial_no, section, step,
      `${measurements.length} ölçüm — ${hasOOT ? 'OOT!' : 'OK'} — ${equipment}`);
    await client.query('COMMIT');
    res.json({ measurements: saved, hasOOT, ootDetails });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// POST /api/steps/:rotorId/:section/:step/toggle-qc — admin toggles QC requirement
router.post('/:rotorId/:section/:step/toggle-qc', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { rotorId, section, step } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ss = await getOrCreate(client, rotorId, section, parseInt(step));
    // Toggle: null/true → false, false → true
    const newVal = ss.qc_required === false ? true : false;
    const { rows } = await client.query(
      'UPDATE step_states SET qc_required=$1 WHERE id=$2 RETURNING *',
      [newVal, ss.id]
    );
    const rotor = await getRotor(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'QC_TOGGLE', rotorId, rotor?.serial_no, section, step,
      `QC gereksinimi ${newVal ? 'açıldı' : 'kapatıldı'}`);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

// PATCH /api/steps/:rotorId/:section/:step/admin-edit  — admin only
// Allows overriding dates and operator name for historical/retroactive entries
router.patch('/:rotorId/:section/:step/admin-edit', auth, requireRole('admin'), async (req, res) => {
  const { rotorId, section, step } = req.params;
  const { startedAt, completedAt, operatorNameOverride } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ss] } = await client.query(
      'SELECT * FROM step_states WHERE rotor_id=$1 AND section=$2 AND step_number=$3',
      [rotorId, section, parseInt(step)]
    );
    if (!ss) return res.status(404).json({ error: 'Adım bulunamadı' });

    const updates = [];
    const vals = [];
    let idx = 1;
    if (startedAt !== undefined)            { updates.push(`started_at=$${idx++}`);              vals.push(startedAt || null); }
    if (completedAt !== undefined)          { updates.push(`completed_at=$${idx++}`);            vals.push(completedAt || null); }
    if (operatorNameOverride !== undefined) { updates.push(`operator_name_override=$${idx++}`);  vals.push(operatorNameOverride || null); }
    if (updates.length === 0) return res.status(400).json({ error: 'Güncellenecek alan yok' });

    vals.push(ss.id);
    const { rows } = await client.query(
      `UPDATE step_states SET ${updates.join(', ')} WHERE id=$${idx} RETURNING *`,
      vals
    );

    // Recalculate duration_min from the updated started_at / completed_at
    await client.query(
      `UPDATE step_states SET duration_min = ROUND(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)
       WHERE id=$1 AND started_at IS NOT NULL AND completed_at IS NOT NULL`,
      [ss.id]
    );

    const rotor = await getRotor(client, rotorId);
    await addAudit(client, req.user.id, req.user.name, 'ADMIN_EDIT', rotorId, rotor?.serial_no, section, step,
      `Tarih/isim düzenlendi: ${JSON.stringify({ startedAt, completedAt, operatorNameOverride })}`);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

module.exports = router;

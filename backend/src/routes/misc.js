const router = require('express').Router();
const pool   = require('../db/pool');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { auth, requireRole } = require('../middleware/auth');

// ─── PROJECTS ───
router.get('/projects', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE active=true ORDER BY id');
  res.json(rows);
});
router.post('/projects', auth, requireRole('admin'), async (req, res) => {
  const { name, code, description } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO projects (name, code, description) VALUES ($1,$2,$3) RETURNING *',
    [name, code, description]
  );
  res.status(201).json(rows[0]);
});

router.patch('/projects/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, code, description, qc_mode, motor_tolerances } = req.body;
  const { rows } = await pool.query(
    `UPDATE projects SET
       name=COALESCE($1,name),
       code=COALESCE($2,code),
       description=COALESCE($3,description),
       qc_mode=COALESCE($4,qc_mode),
       motor_tolerances=COALESCE($5::jsonb,motor_tolerances)
     WHERE id=$6 RETURNING *`,
    [name||null, code||null, description||null,
     qc_mode !== undefined ? qc_mode : null,
     motor_tolerances !== undefined ? JSON.stringify(motor_tolerances) : null,
     req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/projects/:id', auth, requireRole('admin'), async (req, res) => {
  const { rows: [p] } = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  await pool.query('UPDATE projects SET active=false WHERE id=$1', [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id,user_name,action,detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'PROJE_SİL', `${p.name} projesi silindi`]);
  res.json({ ok: true });
});

// ─── PHOTOS (per-step) ───
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const { rotorId } = req.params;
    const stepName = (req.body.stepName || 'Genel').replace(/[^a-zA-Z0-9\s\-_]/g,'').trim();
    const dir = path.join(process.env.UPLOAD_DIR || './uploads',
      'Samsun_Projesi', `rotor-${rotorId}`, stepName);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/rotors/:rotorId/photos', auth, requireRole('admin','qc'), async (req, res) => {
  const { section, stepNumber } = req.query;
  let q = `SELECT p.*, u.name as uploaded_by_name FROM photos p
           LEFT JOIN users u ON u.id = p.uploaded_by WHERE p.rotor_id=$1`;
  const params = [req.params.rotorId];
  if (section)    { params.push(section);              q += ` AND p.section=$${params.length}`; }
  if (stepNumber) { params.push(parseInt(stepNumber)); q += ` AND p.step_number=$${params.length}`; }
  q += ' ORDER BY p.uploaded_at DESC';
  const { rows } = await pool.query(q, params);
  const withData = rows.map(p => {
    let imgData = null;
    try {
      if (p.filepath && fs.existsSync(p.filepath)) {
        const buf = fs.readFileSync(p.filepath);
        const ext = path.extname(p.filepath).slice(1).toLowerCase();
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        imgData = `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch {}
    return { ...p, imgData };
  });
  res.json(withData);
});

router.post('/rotors/:rotorId/photos', auth, upload.single('photo'), async (req, res) => {
  const { rotorId } = req.params;
  const { section, stepNumber, stepName, note } = req.body;
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM photos WHERE rotor_id=$1', [rotorId]);
  if (parseInt(count) >= 10) return res.status(400).json({ error: 'Maksimum 10 fotoğraf (rotor başına)' });
  const { rows } = await pool.query(
    `INSERT INTO photos (rotor_id, filename, filepath, section, step_number, step_name, note, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [rotorId, req.file.originalname, req.file.path,
     section||null, stepNumber?parseInt(stepNumber):null, stepName||null, note||null, req.user.id]
  );
  await pool.query('UPDATE rotors SET photo_count=photo_count+1 WHERE id=$1', [rotorId]);
  let imgData = null;
  try {
    const buf = fs.readFileSync(req.file.path);
    imgData = `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {}
  res.status(201).json({ ...rows[0], imgData });
});

router.delete('/rotors/:rotorId/photos/:photoId', auth, requireRole('admin','qc'), async (req, res) => {
  const { rows: [p] } = await pool.query('SELECT * FROM photos WHERE id=$1 AND rotor_id=$2', [req.params.photoId, req.params.rotorId]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  try { if (p.filepath) fs.unlinkSync(p.filepath); } catch {}
  await pool.query('DELETE FROM photos WHERE id=$1', [p.id]);
  await pool.query('UPDATE rotors SET photo_count=GREATEST(0,photo_count-1) WHERE id=$1', [req.params.rotorId]);
  res.json({ ok: true });
});

// ─── DOCUMENTS ───
router.get('/documents', auth, async (req, res) => {
  const { projectId, category } = req.query;
  let q = `SELECT d.*, u.name as uploaded_by_name FROM documents d
           LEFT JOIN users u ON u.id=d.uploaded_by WHERE 1=1`;
  const params = [];
  if (projectId) { params.push(projectId); q += ` AND d.project_id=$${params.length}`; }
  if (category)  { params.push(category);  q += ` AND d.category=$${params.length}`; }
  q += ' ORDER BY d.created_at DESC';
  const { rows } = await pool.query(q, params);
  res.json(rows);
});
router.post('/documents', auth, requireRole('admin'), async (req, res) => {
  const { projectId, category, title, url } = req.body;
  if (!title||!category) return res.status(400).json({ error: 'title and category required' });
  const { rows } = await pool.query(
    'INSERT INTO documents (project_id,category,title,url,uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [projectId||null, category, title, url||null, req.user.id]
  );
  res.status(201).json(rows[0]);
});
router.delete('/documents/:id', auth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM documents WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── MOTORS ───
router.get('/motors', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, p.name as project_name, p.qc_mode, p.motor_tolerances,
              r.serial_no as rotor_sn, u.name as created_by_name,
              rp.field_timestamps
       FROM motors m LEFT JOIN projects p ON p.id=m.project_id
       LEFT JOIN rotors r ON r.id=m.rotor_id LEFT JOIN users u ON u.id=m.created_by
       LEFT JOIN rotor_parts rp ON rp.rotor_id=m.rotor_id
       ORDER BY m.created_at DESC`
    );
    const ids = rows.map(r => r.id);
    let parts = [];
    if (ids.length) {
      const { rows: pr } = await pool.query(
        `SELECT mp.*, u.name as entered_by_name FROM motor_parts mp
         LEFT JOIN users u ON u.id=mp.entered_by WHERE mp.motor_id=ANY($1) ORDER BY mp.motor_id,mp.id`, [ids]
      );
      parts = pr;
    }
    const byMotor = {};
    parts.forEach(p => { if (!byMotor[p.motor_id]) byMotor[p.motor_id]=[]; byMotor[p.motor_id].push(p); });
    res.json(rows.map(r => ({ ...r, parts: byMotor[r.id]||[] })));
  } catch (e) { console.error('GET /motors error:', e.message); res.status(500).json({ error: e.message }); }
});
router.get('/motors/:id', auth, async (req, res) => {
  try {
    const { rows: [motor] } = await pool.query(
      `SELECT m.*, r.serial_no as rotor_sn, r.shaft_no,
              p.qc_mode, p.motor_tolerances
       FROM motors m
       LEFT JOIN rotors r ON r.id=m.rotor_id
       LEFT JOIN projects p ON p.id=m.project_id
       WHERE m.id=$1`, [req.params.id]
    );
    if (!motor) return res.status(404).json({ error: 'Not found' });
    const { rows: parts } = await pool.query(
      `SELECT mp.*, u.name as entered_by_name FROM motor_parts mp
       LEFT JOIN users u ON u.id=mp.entered_by WHERE mp.motor_id=$1 ORDER BY mp.id`, [req.params.id]
    );
    res.json({ ...motor, parts });
  } catch (e) { console.error('GET /motors/:id error:', e.message); res.status(500).json({ error: e.message }); }
});
router.post('/motors', auth, requireRole('admin','operator'), async (req, res) => {
  const { projectId, motorSn, rotorId, notes } = req.body;
  if (!motorSn) return res.status(400).json({ error: 'motorSn required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO motors (project_id,motor_sn,rotor_id,notes,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [projectId||null, motorSn, rotorId||null, notes||null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code==='23505') return res.status(409).json({ error: 'Bu motor seri no kayıtlı' });
    throw e;
  }
});
router.post('/motors/:id/parts', auth, async (req, res) => {
  const { partName, serialNumber } = req.body;
  if (!partName) return res.status(400).json({ error: 'partName required' });
  const { rows: [motor] } = await pool.query('SELECT * FROM motors WHERE id=$1', [req.params.id]);
  if (!motor) return res.status(404).json({ error: 'Motor not found' });
  if (motor.status==='locked') return res.status(403).json({ error: 'Motor kilitlendi' });
  const existing = await pool.query('SELECT id FROM motor_parts WHERE motor_id=$1 AND part_name=$2', [req.params.id, partName]);
  if (existing.rows[0]) {
    const { rows } = await pool.query(
      'UPDATE motor_parts SET serial_number=$1,entered_by=$2,entered_at=NOW() WHERE motor_id=$3 AND part_name=$4 RETURNING *',
      [serialNumber||null, req.user.id, req.params.id, partName]
    );
    return res.json(rows[0]);
  }
  const { rows } = await pool.query(
    'INSERT INTO motor_parts (motor_id,part_name,serial_number,entered_by) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, partName, serialNumber||null, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.patch('/motors/:motorId/parts/:partId/admin-edit', auth, requireRole('admin'), async (req, res) => {
  const { enteredAtOverride, enteredByNameOverride } = req.body;
  const updates = [];
  const vals = [];
  let idx = 1;
  if (enteredAtOverride !== undefined)      { updates.push(`entered_at_override=$${idx++}`);       vals.push(enteredAtOverride || null); }
  if (enteredByNameOverride !== undefined)  { updates.push(`entered_by_name_override=$${idx++}`);  vals.push(enteredByNameOverride || null); }
  if (updates.length === 0) return res.status(400).json({ error: 'Güncellenecek alan yok' });
  vals.push(req.params.partId, req.params.motorId);
  const { rows } = await pool.query(
    `UPDATE motor_parts SET ${updates.join(', ')} WHERE id=$${idx} AND motor_id=$${idx+1} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Parça bulunamadı' });
  res.json(rows[0]);
});

router.post('/motors/:id/lock', auth, requireRole('admin','operator'), async (req, res) => {
  const { rows } = await pool.query('UPDATE motors SET status=$1 WHERE id=$2 RETURNING *', ['locked', req.params.id]);
  res.json(rows[0]);
});

router.post('/motors/:id/unlock', auth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('UPDATE motors SET status=$1 WHERE id=$2 RETURNING *', ['assembly_pending', req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id,user_name,action,detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'MOTOR_UNLOCK', `Motor ${rows[0]?.motor_sn} kilidi açıldı`]);
  res.json(rows[0]);
});

router.patch('/motors/:id', auth, requireRole('admin'), async (req, res) => {
  const { motorSn, notes, projectId } = req.body;
  const { rows } = await pool.query(
    `UPDATE motors SET
       motor_sn=COALESCE($1,motor_sn),
       notes=COALESCE($2,notes),
       project_id=COALESCE($3,project_id)
     WHERE id=$4 RETURNING *`,
    [motorSn||null, notes||null, projectId||null, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/motors/:id', auth, requireRole('admin'), async (req, res) => {
  const { rows: [m] } = await pool.query('SELECT * FROM motors WHERE id=$1', [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM motor_parts WHERE motor_id=$1', [req.params.id]);
  await pool.query('DELETE FROM motors WHERE id=$1', [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id,user_name,action,detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'MOTOR_SİL', `${m.motor_sn} silindi`]);
  res.json({ ok: true });
});


// ─── MOTOR PHOTOS ───
router.post('/motors/:motorId/photos', auth, upload.single('photo'), async (req, res) => {
  const { motorId } = req.params;
  const { note } = req.body;
  const { rows: [motor] } = await pool.query('SELECT * FROM motors WHERE id=$1', [motorId]);
  if (!motor) return res.status(404).json({ error: 'Motor not found' });

  const { rows } = await pool.query(
    `INSERT INTO photos (rotor_id, filename, filepath, section, step_name, note, uploaded_by)
     VALUES (NULL, $1, $2, 'motor', $3, $4, $5) RETURNING *`,
    [req.file.originalname, req.file.path, `Motor-${motor.motor_sn}`, note||null, req.user.id]
  );
  await pool.query(
    `INSERT INTO motor_parts (motor_id, part_name, serial_number, entered_by)
     VALUES ($1, 'photo_ref', $2, $3)
     ON CONFLICT DO NOTHING`,
    [motorId, `photo:${req.file.filename}`, req.user.id]
  );

  let imgData = null;
  try {
    const buf = fs.readFileSync(req.file.path);
    imgData = `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {}

  res.status(201).json({ ...rows[0], imgData });
});

router.get('/motors/:motorId/photos', auth, async (req, res) => {
  const { rows: [motor] } = await pool.query('SELECT * FROM motors WHERE id=$1', [req.params.motorId]);
  if (!motor) return res.status(404).json({ error: 'Not found' });

  const { rows } = await pool.query(
    `SELECT p.*, u.name as uploaded_by_name FROM photos p
     LEFT JOIN users u ON u.id = p.uploaded_by
     WHERE p.step_name = $1 AND p.section = 'motor'
     ORDER BY p.uploaded_at DESC`,
    [`Motor-${motor.motor_sn}`]
  );

  const withData = rows.map(p => {
    let imgData = null;
    try {
      if (p.filepath && fs.existsSync(p.filepath)) {
        const buf = fs.readFileSync(p.filepath);
        imgData = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
    } catch {}
    return { ...p, imgData };
  });
  res.json(withData);
});


// ─── STEP EQUIPMENT ────────────────────────────────────────
router.get('/step-equipment/:section/:step', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM step_equipment WHERE section=$1 AND step_number=$2 ORDER BY id',
    [req.params.section, parseInt(req.params.step)]
  );
  res.json(rows);
});
router.post('/step-equipment/:section/:step', auth, requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Ekipman adı gerekli' });
  const { rows } = await pool.query(
    'INSERT INTO step_equipment (section, step_number, name, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.section, parseInt(req.params.step), name.trim(), req.user.id]
  );
  res.status(201).json(rows[0]);
});
router.delete('/step-equipment/:id', auth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM step_equipment WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── STEP TOLERANCES ───────────────────────────────────────────
router.get('/step-tolerances/:section/:step', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM step_tolerances WHERE section=$1 AND step_number=$2 ORDER BY meas_index',
    [req.params.section, parseInt(req.params.step)]
  );
  res.json(rows);
});
router.post('/step-tolerances/:section/:step', auth, requireRole('admin'), async (req, res) => {
  const { meas_index, label, nominal, tol_plus, tol_minus, unit, is_min } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO step_tolerances (section, step_number, meas_index, label, nominal, tol_plus, tol_minus, unit, is_min, created_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT (section, step_number, meas_index) DO UPDATE SET
       label=EXCLUDED.label, nominal=EXCLUDED.nominal, tol_plus=EXCLUDED.tol_plus,
       tol_minus=EXCLUDED.tol_minus, unit=EXCLUDED.unit, is_min=EXCLUDED.is_min, updated_at=NOW()
     RETURNING *`,
    [req.params.section, parseInt(req.params.step), meas_index, label, nominal, tol_plus, tol_minus, unit, is_min||false, req.user.id]
  );
  res.status(201).json(rows[0]);
});
router.delete('/step-tolerances/:section/:step/:meas_index', auth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM step_tolerances WHERE section=$1 AND step_number=$2 AND meas_index=$3',
    [req.params.section, parseInt(req.params.step), parseInt(req.params.meas_index)]);
  res.json({ ok: true });
});

// ─── STEP DRAWINGS ───
router.get('/step-drawings/:section/:step', auth, async (req, res) => {
  const { section, step } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM step_drawings WHERE section=$1 AND step_number=$2 ORDER BY id',
    [section, parseInt(step)]
  );
  res.json(rows);
});

router.post('/step-drawings/:section/:step', auth, requireRole('admin'), async (req, res) => {
  const { section, step } = req.params;
  const { label, url } = req.body;
  if (!label?.trim() || !url?.trim()) return res.status(400).json({ error: 'Etiket ve URL gerekli' });
  const { rows } = await pool.query(
    'INSERT INTO step_drawings (section, step_number, label, url, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [section, parseInt(step), label.trim(), url.trim(), req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.delete('/step-drawings/:id', auth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM step_drawings WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── STEP MATERIALS ───
router.get('/step-materials/:section/:step', auth, async (req, res) => {
  const { section, step } = req.params;
  const { rows } = await pool.query(
    'SELECT * FROM step_materials WHERE section=$1 AND step_number=$2 ORDER BY id',
    [section, parseInt(step)]
  );
  res.json(rows);
});

router.post('/step-materials/:section/:step', auth, requireRole('admin'), async (req, res) => {
  const { section, step } = req.params;
  const { material } = req.body;
  if (!material?.trim()) return res.status(400).json({ error: 'Malzeme adı gerekli' });
  const { rows } = await pool.query(
    'INSERT INTO step_materials (section, step_number, material, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *',
    [section, parseInt(step), material.trim(), req.user.id]
  );
  res.status(201).json(rows[0] || { material });
});

router.delete('/step-materials/:id', auth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM step_materials WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── NOTIFICATIONS ───
router.get('/notifications', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE target_role IS NULL OR target_role=$1
     ORDER BY created_at DESC LIMIT 50`, [req.user.role]
  );
  res.json(rows);
});
router.patch('/notifications/read-all', auth, async (req, res) => {
  await pool.query('UPDATE notifications SET unread=false WHERE target_role IS NULL OR target_role=$1', [req.user.role]);
  res.json({ ok: true });
});

// ─── USERS ───
router.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const { rows: [u] } = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Not found' });
  await pool.query(`UPDATE users SET active=false, email=email||'_deleted_'||id WHERE id=$1`, [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id,user_name,action,detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'KULLANICI_SİL', `${u.name} silindi`]);
  res.json({ ok: true });
});

// ─── QC MEASUREMENT EDIT ───
router.patch('/measurements/:id', auth, requireRole('admin','qc'), async (req, res) => {
  const { actualValue } = req.body;
  const { rows: [m] } = await pool.query('SELECT * FROM measurements WHERE id=$1', [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const v = parseFloat(actualValue);
  const inTol = m.is_min_check ? v >= parseFloat(m.nominal)
    : (v <= parseFloat(m.nominal)+parseFloat(m.tol_plus) && v >= parseFloat(m.nominal)-parseFloat(m.tol_minus));
  const { rows } = await pool.query(
    `UPDATE measurements SET actual_value=$1,in_tolerance=$2,
       original_value=COALESCE(original_value,actual_value),edited_by=$3,edited_at=NOW()
     WHERE id=$4 RETURNING *`,
    [v, inTol, req.user.id, req.params.id]
  );
  res.json(rows[0]);
});

// ─── AUDIT LOG ───
router.get('/audit', auth, requireRole('admin'), async (req, res) => {
  const { limit=200, rotorId } = req.query;
  let q = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (rotorId) { params.push(rotorId); q += ` AND rotor_id=$${params.length}`; }
  q += ` ORDER BY created_at DESC LIMIT $${params.push(parseInt(limit))}`;
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// ─── OOT ───
router.get('/oot', auth, requireRole('admin','qc'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.*, r.serial_no, u.name as recorded_by_name FROM oot_records o
     LEFT JOIN rotors r ON r.id=o.rotor_id LEFT JOIN users u ON u.id=o.recorded_by
     ORDER BY o.recorded_at DESC`
  );
  res.json(rows);
});

// ─── SHIFT ───
router.post('/shift', auth, async (req, res) => {
  const { inUserId, note } = req.body;
  const { rows: active } = await pool.query(
    `SELECT ss.*, r.serial_no FROM step_states ss JOIN rotors r ON r.id=ss.rotor_id
     WHERE ss.status IN ('in_progress','paused') AND ss.started_by=$1`, [req.user.id]
  );
  const { rows: [inUser] } = await pool.query('SELECT name FROM users WHERE id=$1', [inUserId]);
  const { rows: [sh] } = await pool.query(
    'INSERT INTO shift_handovers (out_user_id,in_user_id,note,active_steps) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.user.id, inUserId, note, JSON.stringify(active)]
  );
  await pool.query('INSERT INTO audit_log (user_id,user_name,action,detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'VARDİYA_DEVİR',
     `${req.user.name} → ${inUser?.name||inUserId}${active.map(a=>`\n• ${a.serial_no} ${a.section} Adım ${a.step_number}`).join('')}`]);
  res.status(201).json(sh);
});

// ─── ROTOR PARTS ───
router.post('/rotors/:rotorId/parts/save', auth, async (req, res) => {
  const { rotorId } = req.params;
  const fields = ['shaft_sn','stator_sn','bearing_bracket_sn','bearing_de_sn','bearing_nde_sn','tooth_wheel_sn','coupling_sn','assembly_note'];
  const updates = []; const vals = [];
  fields.forEach(f => { if (req.body[f]!==undefined) { updates.push(`${f}=$${vals.push(req.body[f])}`); }});
  if (!updates.length) return res.status(400).json({ error: 'No fields' });
  vals.push(req.user.id, rotorId);
  await pool.query(
    `INSERT INTO rotor_parts (rotor_id,assembled_by,last_updated_by,last_updated_at)
     VALUES ($${vals.length},$${vals.length-1},$${vals.length-1},NOW())
     ON CONFLICT (rotor_id) DO UPDATE SET ${updates.join(',')},last_updated_by=EXCLUDED.last_updated_by,last_updated_at=NOW()`,
    vals
  );
  const { rows } = await pool.query('SELECT * FROM rotor_parts WHERE rotor_id=$1', [rotorId]);
  res.json(rows[0]);
});

// ─── DASHBOARD ───
router.get('/dashboard', auth, async (req, res) => {
  const [rotorStats, recentAudit, qcQueue, ootCount, motorCount] = await Promise.all([
    pool.query('SELECT status, COUNT(*) as count FROM rotors GROUP BY status'),
    pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10'),
    pool.query(
      `SELECT ss.*, r.serial_no, r.id as rotor_id, u.name as started_by_name
       FROM step_states ss JOIN rotors r ON r.id=ss.rotor_id
       LEFT JOIN users u ON u.id=ss.started_by
       WHERE ss.status='qc_pending' ORDER BY ss.started_at`
    ),
    pool.query('SELECT COUNT(*) as count FROM oot_records WHERE resolved=false'),
    pool.query('SELECT COUNT(*) as count FROM motors'),
  ]);
  res.json({
    rotorStats: rotorStats.rows,
    recentAudit: recentAudit.rows,
    qcQueue: qcQueue.rows,
    ootCount: parseInt(ootCount.rows[0].count),
    motorCount: parseInt(motorCount.rows[0].count),
  });
});

// ─── MOTOR TESTS ────────────────────────────────────────────────
router.get('/motors/:motorId/tests', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT mt.*, u1.name as started_by_name, u2.name as completed_by_name
     FROM motor_tests mt
     LEFT JOIN users u1 ON u1.id = mt.started_by
     LEFT JOIN users u2 ON u2.id = mt.completed_by
     WHERE mt.motor_id = $1 ORDER BY mt.id`,
    [req.params.motorId]
  );
  res.json(rows);
});

router.post('/motors/:motorId/tests/:stepCode/start', auth, async (req, res) => {
  const { motorId, stepCode } = req.params;
  const { rows } = await pool.query(
    `INSERT INTO motor_tests (motor_id, step_code, status, started_by, started_at)
     VALUES ($1,$2,'in_progress',$3,NOW())
     ON CONFLICT (motor_id, step_code) DO UPDATE
       SET status='in_progress', started_by=$3, started_at=NOW()
     RETURNING *`,
    [motorId, stepCode, req.user.id]
  );
  res.json(rows[0]);
});

router.post('/motors/:motorId/tests/:stepCode/save', auth, async (req, res) => {
  const { motorId, stepCode } = req.params;
  const { data } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO motor_tests (motor_id, step_code, status, data, started_by, started_at)
     VALUES ($1,$2,'in_progress',$3,$4,NOW())
     ON CONFLICT (motor_id, step_code) DO UPDATE
       SET data=$3, status='in_progress'
     RETURNING *`,
    [motorId, stepCode, JSON.stringify(data), req.user.id]
  );
  res.json(rows[0]);
});

router.post('/motors/:motorId/tests/:stepCode/complete', auth, async (req, res) => {
  const { motorId, stepCode } = req.params;
  const { data } = req.body;
  const { rows } = await pool.query(
    `UPDATE motor_tests SET status='completed', data=COALESCE($1::jsonb, data),
       completed_by=$2, completed_at=NOW()
     WHERE motor_id=$3 AND step_code=$4 RETURNING *`,
    [data ? JSON.stringify(data) : null, req.user.id, motorId, stepCode]
  );
  res.json(rows[0]);
});

router.patch('/motors/:motorId/tests/:stepCode/admin-edit', auth, requireRole('admin'), async (req, res) => {
  const { motorId, stepCode } = req.params;
  const { startedAt, completedAt, operatorNameOverride, data } = req.body;

  const updates = [];
  const vals = [];
  let idx = 1;
  if (startedAt !== undefined)            { updates.push(`started_at=$${idx++}`);              vals.push(startedAt || null); }
  if (completedAt !== undefined)          { updates.push(`completed_at=$${idx++}`);            vals.push(completedAt || null); }
  if (operatorNameOverride !== undefined) { updates.push(`operator_name_override=$${idx++}`);  vals.push(operatorNameOverride || null); }
  if (data !== undefined)                 { updates.push(`data=$${idx++}::jsonb`);             vals.push(JSON.stringify(data)); }
  if (updates.length === 0) return res.status(400).json({ error: 'Güncellenecek alan yok' });

  vals.push(motorId, stepCode);
  const { rows } = await pool.query(
    `UPDATE motor_tests SET ${updates.join(', ')} WHERE motor_id=$${idx} AND step_code=$${idx+1} RETURNING *`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'Test bulunamadı' });
  res.json(rows[0]);
});

module.exports = router;

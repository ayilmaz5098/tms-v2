const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/users — admin only
router.get('/', auth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, active, last_login, created_at FROM users ORDER BY id'
  );
  res.json(rows);
});

// POST /api/users — admin only
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,active',
      [name, email.toLowerCase(), hash, role]
    );
    await pool.query(
      'INSERT INTO audit_log (user_id, user_name, action, detail) VALUES ($1,$2,$3,$4)',
      [req.user.id, req.user.name, 'YENİ_KULLANICI', `${name} (${role}) eklendi`]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    throw e;
  }
});

// PATCH /api/users/:id — toggle active or reset pw
router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { active, password } = req.body;
  if (active !== undefined) {
    await pool.query('UPDATE users SET active = $1 WHERE id = $2', [active, req.params.id]);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.params.id]);
  }
  await pool.query(
    'INSERT INTO audit_log (user_id, user_name, action, detail) VALUES ($1,$2,$3,$4)',
    [req.user.id, req.user.name, 'KULLANICI_GÜNCELLE', `User ${req.params.id} updated`]
  );
  const { rows } = await pool.query(
    'SELECT id, name, email, role, active FROM users WHERE id = $1', [req.params.id]
  );
  res.json(rows[0]);
});

module.exports = router;

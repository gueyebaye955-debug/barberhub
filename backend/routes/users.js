const router = require('express').Router();
const bcrypt = require('bcryptjs');

const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { cleanString, parsePositiveInt } = require('../utils/validators');

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, first_name, last_name, email, phone, city, role, approved, created_at FROM users WHERE id=$1',
    [req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  return res.json(result.rows[0]);
}));

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const firstName = cleanString(req.body?.first_name, { max: 100, allowEmpty: true });
  const lastName = cleanString(req.body?.last_name, { max: 100, allowEmpty: true });
  const phone = cleanString(req.body?.phone, { max: 30, allowEmpty: true });
  const city = cleanString(req.body?.city, { max: 100, allowEmpty: true });
  const password = cleanString(req.body?.password, { min: 8, max: 128, allowEmpty: true });

  const updates = [];
  const values = [];

  if (firstName) {
    values.push(firstName);
    updates.push(`first_name=$${values.length}`);
  }
  if (lastName) {
    values.push(lastName);
    updates.push(`last_name=$${values.length}`);
  }
  if (phone) {
    values.push(phone);
    updates.push(`phone=$${values.length}`);
  }
  if (city) {
    values.push(city);
    updates.push(`city=$${values.length}`);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    values.push(hash);
    updates.push(`password=$${values.length}`);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(req.user.id);
  await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id=$${values.length}`,
    values
  );

  return res.json({ ok: true });
}));

router.get('/notifications', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  );
  return res.json(result.rows);
}));

router.patch('/notifications/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const notificationId = parsePositiveInt(req.params.id);
  if (!notificationId) return res.status(400).json({ error: 'Invalid notification id' });

  await pool.query(
    'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',
    [notificationId, req.user.id]
  );
  return res.json({ ok: true });
}));

router.get('/favorites', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT bp.id, bp.shop_name, bp.rating, u.first_name, u.last_name
     FROM favorites f
     JOIN barber_profiles bp ON bp.id = f.barber_id
     JOIN users u ON u.id = bp.user_id
     WHERE f.user_id=$1`,
    [req.user.id]
  );
  return res.json(result.rows);
}));

router.post('/favorites/:barberId', requireAuth, asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.params.barberId);
  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });

  await pool.query(
    'INSERT INTO favorites(user_id, barber_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
    [req.user.id, barberId]
  );
  return res.json({ ok: true });
}));

router.delete('/favorites/:barberId', requireAuth, asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.params.barberId);
  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });

  await pool.query(
    'DELETE FROM favorites WHERE user_id=$1 AND barber_id=$2',
    [req.user.id, barberId]
  );
  return res.json({ ok: true });
}));

router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
  const result = await pool.query(
    'SELECT id, first_name, last_name, email, phone, city, role, approved, created_at FROM users ORDER BY created_at DESC'
  );
  return res.json(result.rows);
}));

router.patch('/:id/approve', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const userId = parsePositiveInt(req.params.id);
  if (!userId) return res.status(400).json({ error: 'Invalid user id' });

  if (typeof req.body?.approved !== 'boolean') {
    return res.status(400).json({ error: 'approved must be true or false' });
  }

  const userResult = await pool.query(
    'SELECT id, role, city FROM users WHERE id=$1',
    [userId]
  );
  if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
  const targetUser = userResult.rows[0];

  await pool.query('UPDATE users SET approved=$1 WHERE id=$2', [req.body.approved, userId]);

  // Ensure approved barbers always have a profile so /barber/:id can render from DB.
  if (req.body.approved === true && targetUser.role === 'barber') {
    await pool.query(
      `INSERT INTO barber_profiles(user_id, city)
       VALUES($1, $2)
       ON CONFLICT(user_id) DO NOTHING`,
      [targetUser.id, targetUser.city || '']
    );
  }

  return res.json({ ok: true });
}));

module.exports = router;

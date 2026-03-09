const router = require('express').Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/billing — admin gets all billing records for current month (or ?month=2026-03)
router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query?.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);

  // Get all approved barbers + their billing record for the month (if exists)
  const result = await pool.query(`
    SELECT bp.id AS barber_id, bp.shop_name, bp.wave_number,
           u.first_name, u.last_name, u.email, u.phone,
           b.id AS billing_id, b.amount, b.paid, b.paid_at, b.notes
    FROM barber_profiles bp
    JOIN users u ON u.id = bp.user_id AND u.approved = true AND u.role = 'barber'
    LEFT JOIN billing_payments b ON b.barber_id = bp.id AND b.month = $1
    ORDER BY u.first_name, u.last_name
  `, [month]);

  return res.json({ month, records: result.rows });
}));

// PATCH /api/billing/:barberId — admin marks a provider as paid/unpaid for a month
router.patch('/:barberId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const barberId = parseInt(req.params.barberId, 10);
  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });

  const month = /^\d{4}-\d{2}$/.test(req.body?.month || '') ? req.body.month : new Date().toISOString().slice(0, 7);
  const paid = typeof req.body?.paid === 'boolean' ? req.body.paid : null;
  const amount = typeof req.body?.amount === 'number' ? Math.max(0, Math.round(req.body.amount)) : 0;
  const notes = String(req.body?.notes || '').slice(0, 300);

  if (paid === null) return res.status(400).json({ error: 'paid (boolean) is required' });

  await pool.query(`
    INSERT INTO billing_payments (barber_id, month, paid, paid_at, amount, notes)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (barber_id, month) DO UPDATE
      SET paid = EXCLUDED.paid,
          paid_at = EXCLUDED.paid_at,
          amount = EXCLUDED.amount,
          notes = EXCLUDED.notes
  `, [barberId, month, paid, paid ? new Date() : null, amount, notes]);

  return res.json({ ok: true });
}));

module.exports = router;

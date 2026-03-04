const router = require('express').Router();

const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { cleanString, parseISODate, parsePositiveInt } = require('../utils/validators');

router.get('/', asyncHandler(async (req, res) => {
  const city = cleanString(req.query?.city, { max: 100, allowEmpty: true });
  const search = cleanString(req.query?.search, { max: 100, allowEmpty: true });

  let query = `
    SELECT bp.*, u.first_name, u.last_name, u.email, u.phone,
           json_agg(DISTINCT jsonb_build_object(
             'id', s.id, 'name', s.name, 'desc', s.desc,
             'price', s.price, 'duration', s.duration, 'category', s.category
           )) FILTER (WHERE s.id IS NOT NULL) AS services
    FROM barber_profiles bp
    JOIN users u ON u.id = bp.user_id
    LEFT JOIN services s ON s.barber_id = bp.id
    WHERE u.approved = true AND u.role = 'barber'
  `;
  const params = [];

  if (city) {
    params.push(`%${city}%`);
    query += ` AND bp.city ILIKE $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (
      bp.shop_name ILIKE $${params.length}
      OR u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
    )`;
  }

  query += ' GROUP BY bp.id, u.id ORDER BY bp.rating DESC';
  const result = await pool.query(query, params);
  return res.json(result.rows);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.params.id);
  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });

  const barber = await pool.query(`
    SELECT bp.*, u.first_name, u.last_name, u.email, u.phone
    FROM barber_profiles bp
    JOIN users u ON u.id = bp.user_id
    WHERE bp.id = $1 AND u.approved = true
  `, [barberId]);

  if (!barber.rows.length) return res.status(404).json({ error: 'Barber not found' });

  const services = await pool.query('SELECT * FROM services WHERE barber_id=$1', [barberId]);
  const reviews = await pool.query(`
    SELECT r.*, u.first_name || ' ' || u.last_name AS reviewer_name
    FROM reviews r
    LEFT JOIN users u ON u.id = r.customer_id
    WHERE r.barber_id = $1
    ORDER BY r.created_at DESC
  `, [barberId]);

  return res.json({
    ...barber.rows[0],
    services: services.rows,
    reviews: reviews.rows,
  });
}));

router.get('/:id/booked-slots', asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.params.id);
  const date = parseISODate(req.query?.date);

  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });
  if (!date) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const result = await pool.query(
    `SELECT time FROM bookings
     WHERE barber_id=$1 AND date=$2 AND status <> 'cancelled'
     ORDER BY time`,
    [barberId, date]
  );

  return res.json(result.rows.map((row) => row.time));
}));

router.post('/:id/reviews', requireAuth, requireRole('customer'), asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.params.id);
  const rating = parsePositiveInt(req.body?.rating);
  const comment = cleanString(req.body?.comment, { max: 1000, allowEmpty: true }) || '';

  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating 1-5 required' });
  }

  await pool.query(
    'INSERT INTO reviews(barber_id, customer_id, rating, comment) VALUES($1, $2, $3, $4)',
    [barberId, req.user.id, rating, comment]
  );

  const avg = await pool.query(
    'SELECT AVG(rating)::numeric(3,2) AS avg, COUNT(*) AS cnt FROM reviews WHERE barber_id=$1',
    [barberId]
  );

  await pool.query(
    'UPDATE barber_profiles SET rating=$1, review_count=$2 WHERE id=$3',
    [avg.rows[0].avg, avg.rows[0].cnt, barberId]
  );

  return res.status(201).json({ ok: true });
}));

module.exports = router;

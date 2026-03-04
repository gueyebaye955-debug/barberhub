const router = require('express').Router();

const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const {
  cleanString,
  normalizeDbTime,
  parseHHMM,
  parseISODate,
  parsePositiveInt,
  timeToMinutes,
} = require('../utils/validators');

function nonNegativeEnvInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { id, role } = req.user;
  let result;

  if (role === 'customer') {
    result = await pool.query(
      `SELECT b.*, bp.shop_name, u.first_name || ' ' || u.last_name AS barber_full_name
       FROM bookings b
       LEFT JOIN barber_profiles bp ON bp.id = b.barber_id
       LEFT JOIN users u ON u.id = bp.user_id
       WHERE b.customer_id = $1
       ORDER BY b.date DESC, b.time DESC`,
      [id]
    );
  } else if (role === 'barber') {
    const barberProfile = await pool.query('SELECT id FROM barber_profiles WHERE user_id=$1', [id]);
    if (!barberProfile.rows.length) return res.json([]);

    result = await pool.query(
      `SELECT b.*, u.first_name || ' ' || u.last_name AS customer_name, u.phone AS customer_phone
       FROM bookings b
       LEFT JOIN users u ON u.id = b.customer_id
       WHERE b.barber_id = $1
       ORDER BY b.date DESC, b.time DESC`,
      [barberProfile.rows[0].id]
    );
  } else if (role === 'admin') {
    result = await pool.query(
      `SELECT b.*,
              cu.first_name || ' ' || cu.last_name AS customer_name,
              bu.first_name || ' ' || bu.last_name AS barber_full_name
       FROM bookings b
       LEFT JOIN users cu ON cu.id = b.customer_id
       LEFT JOIN barber_profiles bp ON bp.id = b.barber_id
       LEFT JOIN users bu ON bu.id = bp.user_id
       ORDER BY b.created_at DESC`
    );
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json(result.rows);
}));

router.post('/', requireAuth, requireRole('customer'), asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.body?.barber_id);
  const serviceId = parsePositiveInt(req.body?.service_id);
  const date = parseISODate(req.body?.date);
  const time = parseHHMM(req.body?.time);
  const notes = cleanString(req.body?.notes, { max: 1000, allowEmpty: true }) || '';

  if (!barberId || !serviceId || !date || !time) {
    return res.status(400).json({ error: 'barber_id, service_id, date and time are required' });
  }

  const service = await pool.query(
    'SELECT id, barber_id, name, price, duration FROM services WHERE id=$1 AND barber_id=$2',
    [serviceId, barberId]
  );
  if (!service.rows.length) return res.status(404).json({ error: 'Service not found for this barber' });

  const barber = await pool.query(
    `SELECT bp.id,
            bp.user_id,
            bp.travel_buffer_minutes,
            bp.lunch_break_start::text AS lunch_break_start,
            bp.lunch_break_end::text AS lunch_break_end,
            u.first_name || ' ' || u.last_name AS full_name
     FROM barber_profiles bp
     JOIN users u ON u.id = bp.user_id
     WHERE bp.id=$1`,
    [barberId]
  );
  if (!barber.rows.length) return res.status(404).json({ error: 'Barber not found' });

  const svc = service.rows[0];
  const barberProfile = barber.rows[0];
  const globalBufferMinutes = nonNegativeEnvInt('BOOKING_BUFFER_MINUTES', 10);
  const serviceDuration = Math.max(15, parsePositiveInt(svc.duration) || 30);
  const travelBufferMinutes = Math.max(0, parsePositiveInt(barberProfile.travel_buffer_minutes) || 0);
  const requestedBlockMinutes = serviceDuration + globalBufferMinutes + travelBufferMinutes;

  const requestedStartMinutes = timeToMinutes(time);
  if (requestedStartMinutes === null) {
    return res.status(400).json({ error: 'Invalid time format' });
  }
  const requestedEndMinutes = requestedStartMinutes + requestedBlockMinutes;
  if (requestedEndMinutes > 24 * 60) {
    return res.status(400).json({ error: 'Selected appointment exceeds the day window' });
  }

  const lunchStart = normalizeDbTime(barberProfile.lunch_break_start);
  const lunchEnd = normalizeDbTime(barberProfile.lunch_break_end);
  if (lunchStart && lunchEnd) {
    const lunchStartMinutes = timeToMinutes(lunchStart);
    const lunchEndMinutes = timeToMinutes(lunchEnd);
    if (
      lunchStartMinutes !== null
      && lunchEndMinutes !== null
      && requestedStartMinutes < lunchEndMinutes
      && requestedEndMinutes > lunchStartMinutes
    ) {
      return res.status(409).json({ error: 'This time overlaps the barber lunch break' });
    }
  }

  const conflict = await pool.query(
    `SELECT b.id
     FROM bookings b
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN barber_profiles bp ON bp.id = b.barber_id
     WHERE b.barber_id = $1
       AND b.date = $2
       AND b.status <> 'cancelled'
       AND (
         $3::time < (
           b.time::time + make_interval(mins => COALESCE(s.duration, 30) + COALESCE(bp.travel_buffer_minutes, 0) + $4::int)
         )
         AND ($3::time + make_interval(mins => $5::int) > b.time::time)
       )
     LIMIT 1`,
    [barberId, date, time, globalBufferMinutes, requestedBlockMinutes]
  );
  if (conflict.rows.length) {
    return res.status(409).json({ error: 'This slot conflicts with an existing booking' });
  }

  const result = await pool.query(
    `INSERT INTO bookings(customer_id, barber_id, service_id, service_name, barber_name, date, time, price, notes)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [req.user.id, barberId, serviceId, svc.name, barberProfile.full_name, date, time, svc.price, notes]
  );

  await pool.query(
    'INSERT INTO notifications(user_id, title, message) VALUES($1, $2, $3)',
    [barberProfile.user_id, 'New booking', `New ${svc.name} booking for ${date} at ${time}`]
  );

  return res.status(201).json({ ok: true, booking: result.rows[0] });
}));

router.patch('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  const bookingId = parsePositiveInt(req.params.id);
  const status = cleanString(req.body?.status, { max: 20 });
  const validStatuses = ['confirmed', 'completed', 'cancelled'];

  if (!bookingId || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status or booking id' });
  }

  const booking = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
  if (!booking.rows.length) return res.status(404).json({ error: 'Booking not found' });

  const b = booking.rows[0];
  const { id, role } = req.user;

  if (role === 'customer' && b.customer_id !== id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (role === 'barber') {
    const barberProfile = await pool.query('SELECT id FROM barber_profiles WHERE user_id=$1', [id]);
    if (!barberProfile.rows.length || barberProfile.rows[0].id !== b.barber_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  await pool.query('UPDATE bookings SET status=$1 WHERE id=$2', [status, bookingId]);
  return res.json({ ok: true });
}));

module.exports = router;

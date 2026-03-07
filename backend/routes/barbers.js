const router = require('express').Router();

const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const {
  cleanString,
  parseBase64Image,
  parseISODate,
  parseImageUrl,
  parsePositiveInt,
} = require('../utils/validators');

const { uploadImage, deleteImage, isConfigured: cloudinaryConfigured } = require('../utils/cloudinary');

const MAX_PORTFOLIO_PHOTOS = 12;

async function resolveBarberProfileId(userId, db = pool) {
  const result = await db.query('SELECT id FROM barber_profiles WHERE user_id=$1', [userId]);
  if (!result.rows.length) return null;
  return result.rows[0].id;
}

async function fetchPortfolioByBarberId(barberId, db = pool) {
  const result = await db.query(
    `SELECT id, image_url, caption, sort_order, created_at
     FROM barber_portfolio_photos
     WHERE barber_id = $1
     ORDER BY sort_order ASC, created_at ASC, id ASC`,
    [barberId]
  );
  return result.rows;
}

router.get('/', asyncHandler(async (req, res) => {
  const city = cleanString(req.query?.city, { max: 100, allowEmpty: true });
  const search = cleanString(req.query?.search, { max: 100, allowEmpty: true });
  const minRating = parseFloat(req.query?.min_rating);
  const category = cleanString(req.query?.category, { max: 50, allowEmpty: true });
  const validSorts = ['rating', 'reviews', 'price'];
  const sort = validSorts.includes(req.query?.sort) ? req.query.sort : 'rating';
  const limit = Math.min(50, Math.max(1, parseInt(req.query?.limit, 10) || 24));
  const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
  const offset = (page - 1) * limit;

  const conditions = ["u.approved = true", "u.role = 'barber'"];
  const params = [];

  if (city) {
    params.push(`%${city}%`);
    conditions.push(`bp.city ILIKE $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(bp.shop_name ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length})`);
  }
  if (!isNaN(minRating) && minRating > 0) {
    params.push(minRating);
    conditions.push(`bp.rating >= $${params.length}`);
  }
  if (category) {
    params.push(category.toLowerCase());
    conditions.push(`bp.id IN (SELECT barber_id FROM services WHERE LOWER(category) = $${params.length})`);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const orderBy = sort === 'reviews' ? 'bp.review_count DESC, bp.rating DESC'
    : sort === 'price' ? 'min_price ASC NULLS LAST'
    : 'bp.rating DESC';

  const [countResult, dataResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT bp.id)::int AS total FROM barber_profiles bp JOIN users u ON u.id = bp.user_id ${where}`,
      params
    ),
    pool.query(`
      SELECT bp.*, u.first_name, u.last_name, u.email, u.phone,
             json_agg(DISTINCT to_jsonb(s)) FILTER (WHERE s.id IS NOT NULL) AS services,
             COUNT(DISTINCT p.id)::int AS portfolio_count,
             MIN(s.price) AS min_price
      FROM barber_profiles bp
      JOIN users u ON u.id = bp.user_id
      LEFT JOIN services s ON s.barber_id = bp.id
      LEFT JOIN barber_portfolio_photos p ON p.barber_id = bp.id
      ${where}
      GROUP BY bp.id, u.id
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]),
  ]);

  const total = countResult.rows[0].total;
  return res.json({
    data: dataResult.rows,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const barberId = parsePositiveInt(req.params.id);
  if (!barberId) return res.status(400).json({ error: 'Invalid barber id' });

  const barber = await pool.query(`
    SELECT bp.*, u.first_name, u.last_name, u.email, u.phone,
           COALESCE((SELECT COUNT(*)::int FROM barber_portfolio_photos p WHERE p.barber_id = bp.id), 0) AS portfolio_count
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
  const portfolio = await fetchPortfolioByBarberId(barberId);

  return res.json({
    ...barber.rows[0],
    services: services.rows,
    portfolio,
    reviews: reviews.rows,
  });
}));

router.get('/me/portfolio', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });
  const portfolio = await fetchPortfolioByBarberId(barberProfileId);
  return res.json(portfolio);
}));

router.post('/me/portfolio', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const imageUrl = parseImageUrl(req.body?.image_url);
  const caption = cleanString(req.body?.caption ?? '', { max: 160, allowEmpty: true });

  if (!imageUrl) return res.status(400).json({ error: 'A valid image_url is required' });
  if (caption === null) return res.status(400).json({ error: 'caption must be at most 160 characters' });

  const meta = await pool.query(
    `SELECT COUNT(*)::int AS count, COALESCE(MAX(sort_order), -1) + 1 AS next_sort
     FROM barber_portfolio_photos
     WHERE barber_id = $1`,
    [barberProfileId]
  );
  const currentCount = Number(meta.rows[0]?.count) || 0;
  const nextSort = Number(meta.rows[0]?.next_sort) || 0;
  if (currentCount >= MAX_PORTFOLIO_PHOTOS) {
    return res.status(400).json({ error: `Maximum ${MAX_PORTFOLIO_PHOTOS} portfolio photos reached` });
  }

  const inserted = await pool.query(
    `INSERT INTO barber_portfolio_photos(barber_id, image_url, caption, sort_order)
     VALUES($1, $2, $3, $4)
     RETURNING id, image_url, caption, sort_order, created_at`,
    [barberProfileId, imageUrl, caption, nextSort]
  );
  return res.status(201).json(inserted.rows[0]);
}));

// Upload a photo from device (base64 data URI → stored directly in DB)
router.post('/me/portfolio/upload', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const imageData = parseBase64Image(req.body?.image_data);
  if (!imageData) return res.status(400).json({ error: 'A valid base64 image is required (JPEG/PNG/WebP, max 1.5 MB)' });

  const caption = cleanString(req.body?.caption ?? '', { max: 160, allowEmpty: true });
  if (caption === null) return res.status(400).json({ error: 'caption must be at most 160 characters' });

  const meta = await pool.query(
    `SELECT COUNT(*)::int AS count, COALESCE(MAX(sort_order), -1) + 1 AS next_sort
     FROM barber_portfolio_photos WHERE barber_id = $1`,
    [barberProfileId]
  );
  const currentCount = Number(meta.rows[0]?.count) || 0;
  const nextSort = Number(meta.rows[0]?.next_sort) || 0;
  if (currentCount >= MAX_PORTFOLIO_PHOTOS) {
    return res.status(400).json({ error: `Maximum ${MAX_PORTFOLIO_PHOTOS} portfolio photos reached` });
  }

  const inserted = await pool.query(
    `INSERT INTO barber_portfolio_photos(barber_id, image_url, caption, sort_order)
     VALUES($1, $2, $3, $4)
     RETURNING id, image_url, caption, sort_order, created_at`,
    [barberProfileId, imageData, caption, nextSort]
  );
  return res.status(201).json(inserted.rows[0]);
}));

router.patch('/me/portfolio/:photoId', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const photoId = parsePositiveInt(req.params.photoId);
  const caption = cleanString(req.body?.caption, { max: 160, allowEmpty: true });
  if (!photoId) return res.status(400).json({ error: 'Invalid photo id' });
  if (caption === null) return res.status(400).json({ error: 'caption must be a string up to 160 characters' });

  const updated = await pool.query(
    `UPDATE barber_portfolio_photos
     SET caption = $1
     WHERE id = $2 AND barber_id = $3
     RETURNING id, image_url, caption, sort_order, created_at`,
    [caption, photoId, barberProfileId]
  );
  if (!updated.rows.length) return res.status(404).json({ error: 'Photo not found' });
  return res.json(updated.rows[0]);
}));

router.put('/me/portfolio/reorder', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const photoIdsRaw = req.body?.photo_ids;
  if (!Array.isArray(photoIdsRaw)) {
    return res.status(400).json({ error: 'photo_ids must be an array of ids' });
  }

  const parsedIds = photoIdsRaw.map((id) => parsePositiveInt(id));
  if (parsedIds.some((id) => !id)) {
    return res.status(400).json({ error: 'photo_ids must contain only positive integer ids' });
  }

  const uniqueIds = new Set(parsedIds);
  if (uniqueIds.size !== parsedIds.length) {
    return res.status(400).json({ error: 'photo_ids must not contain duplicates' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM barber_portfolio_photos WHERE barber_id = $1 ORDER BY sort_order ASC, created_at ASC, id ASC',
      [barberProfileId]
    );
    const existingIds = existing.rows.map((row) => Number(row.id));
    if (existingIds.length !== parsedIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'photo_ids must include all portfolio photos exactly once' });
    }

    const existingIdSet = new Set(existingIds);
    const allOwned = parsedIds.every((id) => existingIdSet.has(id));
    if (!allOwned) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'photo_ids must only include your own photos' });
    }

    for (let index = 0; index < parsedIds.length; index += 1) {
      await client.query(
        'UPDATE barber_portfolio_photos SET sort_order = $1 WHERE barber_id = $2 AND id = $3',
        [index, barberProfileId, parsedIds[index]]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }

  const portfolio = await fetchPortfolioByBarberId(barberProfileId);
  return res.json({ ok: true, portfolio });
}));

router.delete('/me/portfolio/:photoId', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const photoId = parsePositiveInt(req.params.photoId);
  if (!photoId) return res.status(400).json({ error: 'Invalid photo id' });

  const removed = await pool.query(
    'DELETE FROM barber_portfolio_photos WHERE id = $1 AND barber_id = $2 RETURNING id',
    [photoId, barberProfileId]
  );
  if (!removed.rows.length) return res.status(404).json({ error: 'Photo not found' });

  await pool.query(
    `WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC, id ASC) - 1 AS next_sort
      FROM barber_portfolio_photos
      WHERE barber_id = $1
    )
    UPDATE barber_portfolio_photos p
    SET sort_order = ordered.next_sort
    FROM ordered
    WHERE p.id = ordered.id`,
    [barberProfileId]
  );

  return res.json({ ok: true });
}));

// ── Service CRUD ────────────────────────────────────────────────────────────

router.get('/me/services', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });
  const result = await pool.query(
    'SELECT id, name, "desc", price, duration, category, image_url FROM services WHERE barber_id=$1 ORDER BY id ASC',
    [barberProfileId]
  );
  return res.json(result.rows);
}));

router.post('/me/services', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const name = cleanString(req.body?.name, { max: 150 });
  const desc = cleanString(req.body?.desc, { max: 500, allowEmpty: true }) || null;
  const price = parseInt(req.body?.price, 10);
  const duration = parseInt(req.body?.duration, 10) || 30;
  const category = cleanString(req.body?.category, { max: 50, allowEmpty: true }) || null;

  if (!name) return res.status(400).json({ error: 'Service name is required' });
  if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Valid price (in cents) is required' });

  const inserted = await pool.query(
    `INSERT INTO services(barber_id, name, "desc", price, duration, category)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id, name, "desc", price, duration, category, image_url`,
    [barberProfileId, name, desc, price, duration, category]
  );
  return res.status(201).json(inserted.rows[0]);
}));

router.patch('/me/services/:id', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const serviceId = parsePositiveInt(req.params.id);
  if (!serviceId) return res.status(400).json({ error: 'Invalid service id' });

  const updates = [];
  const values = [];

  const name = cleanString(req.body?.name, { max: 150, allowEmpty: true });
  if (name) { values.push(name); updates.push(`name=$${values.length}`); }

  if (req.body?.desc !== undefined) {
    const desc = cleanString(req.body.desc, { max: 500, allowEmpty: true }) || null;
    values.push(desc); updates.push(`"desc"=$${values.length}`);
  }
  if (req.body?.price !== undefined) {
    const price = parseInt(req.body.price, 10);
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid price' });
    values.push(price); updates.push(`price=$${values.length}`);
  }
  if (req.body?.duration !== undefined) {
    const duration = parseInt(req.body.duration, 10);
    if (isNaN(duration) || duration < 5) return res.status(400).json({ error: 'Invalid duration' });
    values.push(duration); updates.push(`duration=$${values.length}`);
  }
  if (req.body?.category !== undefined) {
    const category = cleanString(req.body.category, { max: 50, allowEmpty: true }) || null;
    values.push(category); updates.push(`category=$${values.length}`);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  values.push(serviceId, barberProfileId);
  const updated = await pool.query(
    `UPDATE services SET ${updates.join(', ')}
     WHERE id=$${values.length - 1} AND barber_id=$${values.length}
     RETURNING id, name, "desc", price, duration, category, image_url`,
    values
  );
  if (!updated.rows.length) return res.status(404).json({ error: 'Service not found' });
  return res.json(updated.rows[0]);
}));

router.post('/me/services/:id/image', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  if (!cloudinaryConfigured()) {
    return res.status(503).json({ error: 'Image storage not configured' });
  }

  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const serviceId = parsePositiveInt(req.params.id);
  if (!serviceId) return res.status(400).json({ error: 'Invalid service id' });

  const imageData = parseBase64Image(req.body?.image_data);
  if (!imageData) return res.status(400).json({ error: 'A valid base64 image is required (JPEG/PNG/WebP, max 1.5 MB)' });

  // Check service belongs to this barber
  const existing = await pool.query(
    'SELECT id, image_url FROM services WHERE id=$1 AND barber_id=$2',
    [serviceId, barberProfileId]
  );
  if (!existing.rows.length) return res.status(404).json({ error: 'Service not found' });

  // Delete old image from Cloudinary if it exists
  const oldUrl = existing.rows[0].image_url;
  if (oldUrl && oldUrl.includes('cloudinary.com')) {
    deleteImage(oldUrl).catch(() => {});
  }

  const imageUrl = await uploadImage(imageData, 'jotma/services');

  const updated = await pool.query(
    `UPDATE services SET image_url=$1 WHERE id=$2 AND barber_id=$3
     RETURNING id, name, "desc", price, duration, category, image_url`,
    [imageUrl, serviceId, barberProfileId]
  );
  return res.json(updated.rows[0]);
}));

router.delete('/me/services/:id', requireAuth, requireRole('barber'), asyncHandler(async (req, res) => {
  const barberProfileId = await resolveBarberProfileId(req.user.id);
  if (!barberProfileId) return res.status(404).json({ error: 'Barber profile not found' });

  const serviceId = parsePositiveInt(req.params.id);
  if (!serviceId) return res.status(400).json({ error: 'Invalid service id' });

  const removed = await pool.query(
    'DELETE FROM services WHERE id=$1 AND barber_id=$2 RETURNING id, image_url',
    [serviceId, barberProfileId]
  );
  if (!removed.rows.length) return res.status(404).json({ error: 'Service not found' });

  const oldUrl = removed.rows[0].image_url;
  if (oldUrl && oldUrl.includes('cloudinary.com')) {
    deleteImage(oldUrl).catch(() => {});
  }

  return res.json({ ok: true });
}));

// ── Booked slots ─────────────────────────────────────────────────────────────

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

const jwt = require('jsonwebtoken');
const router = require('express').Router();

const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cleanString, parsePositiveInt } = require('../utils/validators');

const JWT_ISSUER = process.env.JWT_ISSUER || 'jelall';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'jelall-web';
const FUNNEL_STEPS = ['homepage_view', 'barber_search', 'profile_view', 'booking_start', 'booking_complete'];

function parseMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  try {
    const serialized = JSON.stringify(meta);
    if (serialized.length > 8000) return {};
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}

function getOptionalUserId(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return Number(payload?.id) || null;
  } catch {
    return null;
  }
}

router.post('/events', asyncHandler(async (req, res) => {
  const name = cleanString(req.body?.name, { min: 2, max: 80 });
  if (!name) return res.status(400).json({ error: 'Event name required' });

  const page = cleanString(req.body?.page || '', { max: 120, allowEmpty: true }) || '';
  const meta = parseMeta(req.body?.meta);
  const userId = getOptionalUserId(req);
  const ip = cleanString(String(req.ip || ''), { max: 120, allowEmpty: true }) || '';
  const userAgent = cleanString(String(req.headers['user-agent'] || ''), { max: 500, allowEmpty: true }) || '';

  await pool.query(
    `INSERT INTO analytics_events(event_name, page, user_id, ip, user_agent, meta)
     VALUES($1, $2, $3, NULLIF($4, '')::inet, $5, $6::jsonb)`,
    [name, page, userId, ip, userAgent, JSON.stringify(meta)]
  );
  return res.json({ ok: true });
}));

router.post('/errors', asyncHandler(async (req, res) => {
  const message = cleanString(req.body?.message, { min: 1, max: 2000 });
  if (!message) return res.status(400).json({ error: 'Error message required' });

  const source = cleanString(req.body?.source, { max: 80, allowEmpty: true }) || 'client';
  const stack = cleanString(req.body?.stack, { max: 4000, allowEmpty: true }) || '';
  const page = cleanString(req.body?.page, { max: 120, allowEmpty: true }) || '';
  const meta = parseMeta(req.body?.meta);
  const userId = getOptionalUserId(req);

  await pool.query(
    `INSERT INTO error_events(source, message, stack, page, user_id, meta)
     VALUES($1, $2, $3, $4, $5, $6::jsonb)`,
    [source, message, stack, page, userId, JSON.stringify(meta)]
  );
  return res.json({ ok: true });
}));

router.post('/uptime', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const target = cleanString(req.body?.target, { min: 1, max: 120 }) || 'unknown';
  const ok = req.body?.ok === true;
  const status = Number.isFinite(Number(req.body?.status_code)) ? Number(req.body.status_code) : 0;
  const latency = Number.isFinite(Number(req.body?.latency_ms)) ? Number(req.body.latency_ms) : 0;
  const error = cleanString(req.body?.error, { max: 2000, allowEmpty: true }) || '';

  await pool.query(
    `INSERT INTO uptime_checks(target, ok, status_code, latency_ms, error)
     VALUES($1, $2, $3, $4, $5)`,
    [target, ok, status, latency, error]
  );
  return res.json({ ok: true });
}));

router.get('/funnel', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const days = parsePositiveInt(req.query?.days) || 7;
  const safeDays = Math.min(90, Math.max(1, days));
  const result = await pool.query(
    `SELECT event_name, COUNT(*)::int AS total
     FROM analytics_events
     WHERE created_at >= NOW() - make_interval(days => $1::int)
       AND event_name = ANY($2::text[])
     GROUP BY event_name`,
    [safeDays, FUNNEL_STEPS]
  );

  const counts = {};
  FUNNEL_STEPS.forEach((step) => { counts[step] = 0; });
  result.rows.forEach((row) => {
    counts[row.event_name] = Number(row.total) || 0;
  });

  const conversion = {};
  for (let i = 1; i < FUNNEL_STEPS.length; i += 1) {
    const prev = counts[FUNNEL_STEPS[i - 1]] || 0;
    const cur = counts[FUNNEL_STEPS[i]] || 0;
    conversion[FUNNEL_STEPS[i]] = prev > 0 ? ((cur / prev) * 100) : 0;
  }

  return res.json({ ok: true, days: safeDays, counts, conversion });
}));

router.get('/errors', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const limit = parsePositiveInt(req.query?.limit) || 20;
  const safeLimit = Math.min(200, Math.max(1, limit));
  const result = await pool.query(
    `SELECT id, source, message, stack, page, user_id, meta, created_at
     FROM error_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return res.json({ ok: true, rows: result.rows });
}));

router.get('/uptime', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const hours = parsePositiveInt(req.query?.hours) || 24;
  const safeHours = Math.min(168, Math.max(1, hours));
  const rows = await pool.query(
    `SELECT id, target, ok, status_code, latency_ms, error, created_at
     FROM uptime_checks
     WHERE created_at >= NOW() - make_interval(hours => $1::int)
     ORDER BY created_at DESC
     LIMIT 200`,
    [safeHours]
  );

  const total = rows.rows.length;
  const success = rows.rows.filter((r) => r.ok).length;
  const avgLatency = total
    ? Math.round(rows.rows.reduce((sum, row) => sum + Number(row.latency_ms || 0), 0) / total)
    : 0;

  return res.json({
    ok: true,
    hours: safeHours,
    summary: {
      total,
      success,
      failure: total - success,
      rate: total ? (success / total) * 100 : 0,
      avgLatency,
    },
    rows: rows.rows,
  });
}));

module.exports = router;

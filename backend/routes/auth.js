const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../db');
const mailer = require('../mailer');
const asyncHandler = require('../utils/asyncHandler');
const { cleanString, normalizeEmail } = require('../utils/validators');
const passport = require('../utils/passport');

function makeJwt(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=google', session: false }),
  (req, res) => {
    const user = req.user;
    const token = makeJwt(user);
    const { password: _p, ...safeUser } = user;
    const encoded = encodeURIComponent(JSON.stringify(safeUser));
    res.redirect(`/login.html?token=${token}&user=${encoded}`);
  }
);
// ─────────────────────────────────────────────────────────────────────────────

router.post('/register/send-code', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Valid email required' });

  const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

  const code = String(Math.floor(100000 + (Math.random() * 900000)));
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `INSERT INTO verify_codes(email, code, expires_at, attempts)
     VALUES($1, $2, $3, 0)
     ON CONFLICT(email) DO UPDATE
     SET code=$2, expires_at=$3, attempts=0`,
    [email, code, expires]
  );

  const sent = await mailer.sendCode(email, code);
  if (!sent) {
    return res.json({ ok: true, demo: true, code });
  }
  return res.json({ ok: true, demo: false });
}));

router.post('/register', asyncHandler(async (req, res) => {
  const firstName = cleanString(req.body?.first_name, { min: 1, max: 100 });
  const lastName = cleanString(req.body?.last_name, { min: 1, max: 100 });
  const email = normalizeEmail(req.body?.email);
  const password = cleanString(req.body?.password, { min: 8, max: 128 });
  const phone = cleanString(req.body?.phone, { max: 30, allowEmpty: true }) || '';
  const city = cleanString(req.body?.city, { max: 100, allowEmpty: true }) || '';
  const code = cleanString(String(req.body?.code || ''), { min: 6, max: 6 });
  const requestedRole = cleanString(req.body?.role, { max: 20, allowEmpty: true });
  const role = requestedRole || 'customer';

  if (!firstName || !lastName || !email || !password || !code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['customer', 'barber'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const rec = await pool.query('SELECT * FROM verify_codes WHERE email=$1', [email]);
  if (!rec.rows.length) {
    return res.status(400).json({ error: 'No verification code found. Request a new one.' });
  }

  const vc = rec.rows[0];
  if (new Date() > new Date(vc.expires_at)) {
    await pool.query('DELETE FROM verify_codes WHERE email=$1', [email]);
    return res.status(400).json({ error: 'Code expired. Please sign up again.' });
  }
  if (vc.attempts >= 3) {
    return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
  }
  if (vc.code !== code) {
    await pool.query('UPDATE verify_codes SET attempts=attempts+1 WHERE email=$1', [email]);
    return res.status(400).json({ error: 'Incorrect code' });
  }

  await pool.query('DELETE FROM verify_codes WHERE email=$1', [email]);

  const hash = await bcrypt.hash(password, 10);
  const approved = role === 'customer';
  const result = await pool.query(
    `INSERT INTO users(first_name, last_name, email, password, phone, city, role, approved)
     VALUES($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, first_name, last_name, email, role, approved`,
    [firstName, lastName, email, hash, phone, city, role, approved]
  );

  const user = result.rows[0];

  if (role === 'barber') {
    await pool.query(
      'INSERT INTO barber_profiles(user_id, city) VALUES($1, $2)',
      [user.id, city]
    );
  }

  const token = makeJwt(user);

  return res.status(201).json({ ok: true, token, user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = cleanString(req.body?.password, { min: 1, max: 128 });

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!result.rows.length) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  const token = makeJwt(user);
  const { password: _ignoredPassword, ...safeUser } = user;
  return res.json({ ok: true, token, user: safeUser });
}));

module.exports = router;

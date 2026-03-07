const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../db');
const mailer = require('../mailer');
const asyncHandler = require('../utils/asyncHandler');
const { cleanString, normalizeEmail } = require('../utils/validators');
const passport = require('../utils/passport');
const { getCaptchaConfig, verifyCaptchaToken } = require('../utils/captcha');

const isProduction = process.env.NODE_ENV === 'production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'jotma';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'jotma-web';
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_LOCKOUT_ATTEMPTS || 5);
const LOGIN_LOCKOUT_MS = Number(process.env.LOGIN_LOCKOUT_MS || (15 * 60 * 1000));
const loginAttemptStore = new Map();

function makeJwt(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    }
  );
}

function getLoginAttemptKey(req, email) {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || '').trim();
  return `${ip}:${email}`;
}

function getLoginAttemptInfo(key) {
  const rec = loginAttemptStore.get(key) || { count: 0, lockedUntil: 0 };
  if (rec.lockedUntil > 0 && rec.lockedUntil <= Date.now()) {
    loginAttemptStore.delete(key);
    return { count: 0, lockedUntil: 0 };
  }
  return rec;
}

function markFailedAttempt(key) {
  const current = getLoginAttemptInfo(key);
  const next = { ...current, count: current.count + 1 };
  if (next.count >= LOGIN_MAX_ATTEMPTS) {
    next.count = 0;
    next.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  loginAttemptStore.set(key, next);
  return next;
}

function clearAttempts(key) {
  loginAttemptStore.delete(key);
}

function jwtVerifyOptions() {
  return {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
}

// Google OAuth
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

router.get('/captcha-config', (_req, res) => {
  const cfg = getCaptchaConfig();
  return res.json({
    enabled: cfg.enabled,
    site_key: cfg.enabled ? cfg.siteKey : '',
  });
});

router.post('/register/send-code', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Valid email required' });

  const captcha = await verifyCaptchaToken(req.body?.captcha_token, req.ip);
  if (!captcha.ok) {
    return res.status(400).json({ error: 'CAPTCHA verification failed' });
  }

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
    if (isProduction) {
      return res.status(503).json({ error: 'Email service unavailable. Please try again later.' });
    }
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

  const captcha = await verifyCaptchaToken(req.body?.captcha_token, req.ip);
  if (!captcha.ok) {
    return res.status(400).json({ error: 'CAPTCHA verification failed' });
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

  const hash = await bcrypt.hash(password, 12);
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

  const captcha = await verifyCaptchaToken(req.body?.captcha_token, req.ip);
  if (!captcha.ok) {
    return res.status(400).json({ error: 'CAPTCHA verification failed' });
  }

  const attemptKey = getLoginAttemptKey(req, email);
  const attemptInfo = getLoginAttemptInfo(attemptKey);
  if (attemptInfo.lockedUntil && attemptInfo.lockedUntil > Date.now()) {
    const mins = Math.ceil((attemptInfo.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Too many login attempts. Try again in ${mins} minute(s).` });
  }

  const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!result.rows.length) {
    markFailedAttempt(attemptKey);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    markFailedAttempt(attemptKey);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  clearAttempts(attemptKey);
  const token = makeJwt(user);
  const { password: _ignoredPassword, ...safeUser } = user;
  return res.json({ ok: true, token, user: safeUser });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, jwtVerifyOptions());
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const result = await pool.query(
    'SELECT id, first_name, last_name, email, role, approved, phone, city, created_at FROM users WHERE id=$1',
    [payload.id]
  );
  if (!result.rows.length) {
    return res.status(401).json({ error: 'Account not found' });
  }
  const user = result.rows[0];
  const token = makeJwt(user);
  return res.json({ ok: true, token, user });
}));

module.exports = router;

require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const path = require('path');

const passport = require('./utils/passport');
const pool = require('./db');
const asyncHandler = require('./utils/asyncHandler');
const { sendOpsAlert } = require('./utils/alerts');

const app = express();
app.disable('x-powered-by');

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = String(process.env.JWT_SECRET || '');
const sessionSecret = String(process.env.SESSION_SECRET || process.env.JWT_SECRET || '');
const defaultProdOrigins = ['https://jotma.net', 'https://www.jotma.net'];
const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || (60 * 60 * 1000));

if (!jwtSecret) {
  console.error('Missing JWT_SECRET in environment. Set it in backend/.env before starting the server.');
  process.exit(1);
}
if (isProduction && jwtSecret.length < 32) {
  console.error('JWT_SECRET is too short for production (minimum: 32 chars).');
  process.exit(1);
}
if (isProduction && !process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET not set; falling back to JWT_SECRET for sessions.');
}

if (process.env.TRUST_PROXY === 'true' || isProduction) {
  app.set('trust proxy', 1);
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (isProduction && allowedOrigins.length === 0) {
  allowedOrigins.push(...defaultProdOrigins);
}

// Session + Passport (only needed for Google OAuth redirect flow)
app.use(session({
  name: 'bh_sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: sessionMaxAgeMs,
  },
}));
app.use(passport.initialize());

// Add request id and lightweight API timing logs.
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    if (!req.originalUrl.startsWith('/api')) return;
    const ms = Date.now() - startedAt;
    console.log(`[${new Date().toISOString()}] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Frontend currently relies on inline handlers/scripts. Keep CSP strict but compatible.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      formAction: ["'self'"],
    },
  },
}));

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests (curl, server-to-server).
    if (!origin) return callback(null, true);
    if (origin === 'null') {
      if (isProduction) return callback(new Error('Origin not allowed by CORS'));
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '3mb' }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth/login', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
}));

app.use('/api/auth/register/send-code', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.SEND_CODE_RATE_LIMIT_MAX || 6),
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 12),
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/health', asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  await pool.query('SELECT 1');
  const dbLatencyMs = Date.now() - startedAt;
  res.json({
    ok: true,
    service: 'jotma-backend',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    db_latency_ms: dbLatencyMs,
  });
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/metrics', require('./routes/metrics'));
try {
  app.use('/api/chat', require('./routes/chat'));
  console.log('[BOOT] /api/chat route loaded OK');
} catch (e) {
  console.error('[BOOT] Failed to load /api/chat route:', e.message);
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

const frontendDir = path.join(__dirname, '..');

// HTML files: always revalidate so mobile browsers pick up new deploys immediately
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || !req.path.includes('.')) {
    res.set('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});
app.use(express.static(frontendDir, { etag: true, lastModified: true }));

app.get('/barber/:id', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'profile.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, req, res, _next) => {
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'CORS origin denied' });
  }

  const requestId = req?.requestId || 'unknown';
  console.error(`[${requestId}]`, err.stack || err.message);
  sendOpsAlert('Unhandled backend error', {
    request_id: requestId,
    path: req?.originalUrl || '',
    method: req?.method || '',
    message: err?.message || 'Unknown error',
  }).catch(() => {});
  return res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  sendOpsAlert('Unhandled rejection', {
    reason: String(reason && reason.message ? reason.message : reason),
  }).catch(() => {});
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  sendOpsAlert('Uncaught exception', {
    message: error?.message || 'Unknown',
  }).finally(() => process.exit(1));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`JOTMA backend running on http://localhost:${PORT}`);
});

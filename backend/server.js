require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('./utils/passport');
const path = require('path');

const pool = require('./db');
const asyncHandler = require('./utils/asyncHandler');

const app = express();
app.disable('x-powered-by');

// Session + Passport (only needed for Google OAuth redirect flow)
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 5 * 60 * 1000 },
}));
app.use(passport.initialize());

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in environment. Set it in backend/.env before starting the server.');
  process.exit(1);
}

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// The frontend currently relies on inline scripts/event handlers across pages.
// Keep Helmet protections, but relax CSP enough so production matches localhost behavior.
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
    },
  },
}));

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl)
    // and 'null' origin which browsers send for file:// pages
    if (!origin || origin === 'null' || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '3mb' })); // 3mb to allow base64 image uploads

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/auth', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/health', asyncHandler(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'barberhub-backend' });
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));

app.get('/barber/:id', (req, res) => {
  res.sendFile(path.join(frontendDir, 'profile.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'CORS origin denied' });
  }
  console.error(err.stack || err.message);
  return res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`BarberHub backend running on http://localhost:${PORT}`);
});

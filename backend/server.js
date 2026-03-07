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

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch (_) {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
}

function getGeminiApiKey() {
  return String(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

function normalizeGeminiModel(value) {
  const model = String(value || '').trim();
  if (!model) return '';
  const alias = {
    'gemini-flash-latest': 'gemini-2.0-flash',
    'gemini-1.5-flash': 'gemini-2.0-flash',
    'gemini-1.5-flash-latest': 'gemini-2.0-flash',
  };
  return alias[model.toLowerCase()] || model;
}

function getGeminiModelCandidates() {
  const configured = normalizeGeminiModel(process.env.GEMINI_MODEL || '');
  const candidates = [
    configured || 'gemini-2.0-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];
  return candidates.filter((model, index, arr) => model && arr.indexOf(model) === index);
}

function shouldTryNextGeminiModel(statusCode, responseBody) {
  const body = String(responseBody || '').toLowerCase();
  if (statusCode === 404 || statusCode === 429 || statusCode === 503) return true;
  if (body.includes('not found') || body.includes('not supported for generatecontent')) return true;
  if (body.includes('high demand') || body.includes('unavailable')) return true;
  return false;
}

function getSupportReply(lang) {
  const replies = {
    en: "I'm here to help you find and book services on JOTMA.\n\nFor more questions, please contact us:\n+1 313 989 6811\ngueyebaye955@gmail.com",
    fr: "Je suis ici pour vous aider a trouver et reserver des services sur JOTMA.\n\nPour plus de questions, veuillez nous contacter:\n+1 313 989 6811\ngueyebaye955@gmail.com",
    wo: "Maa ngi fi ngir la japp ci JOTMA ngir giss te tekki rendez-vous.\n\nSu laaj yu ci des amee, jokkoo ak nun:\n+1 313 989 6811\ngueyebaye955@gmail.com",
  };
  return replies[lang] || replies.fr;
}

function isOffTopicMessage(text) {
  const q = String(text || '').toLowerCase();
  const offTopicRx = /(politic|politique|election|president|religion|islam|christian|news|actualit|world news|medical|doctor|sante|health advice|legal|lawyer|justice|investment advice|relationship advice|personal advice)/i;
  return offTopicRx.test(q);
}

function detectProvider(text) {
  const q = String(text || '').toLowerCase();
  const providers = [
    { id: 1, name: 'Carlos Cuts', aliases: ['carlos', 'carlos cuts'] },
    { id: 2, name: 'Sofia Style Lab', aliases: ['sofia', 'sofia style lab', "sofia's style lab"] },
    { id: 3, name: 'Marcus Fresh Cuts', aliases: ['marcus', 'marcus fresh cuts'] },
  ];
  return providers.find((p) => p.aliases.some((a) => q.includes(a))) || null;
}

function buildRuleBasedReply(message, lang = 'fr') {
  const text = String(message || '').trim();
  const q = text.toLowerCase();

  if (!text) {
    return lang === 'en'
      ? 'Tell me the service you need, your preferred date/time, and your city.'
      : (lang === 'wo'
        ? 'Wax ma sarwiis bi nga soxla, kañ nga bëgg, ak dëkk bi nga nekk.'
        : 'Dites-moi le service voulu, la date/heure souhaitee et votre ville.');
  }

  if (isOffTopicMessage(q)) {
    return getSupportReply(lang);
  }

  const wantsBooking = /(book|booking|appointment|rendez|rdv|reserve|reserver|réserver|tekki|tomorrow|demain|today|aujourd|am|pm|\d{1,2}:\d{2}|\d{1,2}h)/i.test(q);
  const provider = detectProvider(q);
  const hasCity = /(dakar|thi[eè]s|diourbel|saint-louis|louga|matam|tambacounda|k[eé]dougou|kaffrine|kaolack|fatick|kolda|s[eé]dhiou|ziguinchor)/i.test(q);
  const hasService = /(haircut|fade|braid|nails|salon|barber|coiff|tresse|makeup|massage|service)/i.test(q);
  const hasTime = /(tomorrow|demain|today|aujourd|am|pm|\b\d{1,2}(:\d{2})?\s?(am|pm|h)?\b)/i.test(q);

  if (provider && wantsBooking) {
    const link = `/book.html?barber=${provider.id}`;
    if (lang === 'en') {
      return `Great choice. Book ${provider.name} here: ${link}\n\nTo confirm quickly, tell me the service and city.\nPolicy: arrive 10 minutes early, 10% deposit, cancel at least 8 hours before.`;
    }
    if (lang === 'wo') {
      return `${provider.name} baax na. Tekkal fii: ${link}\n\nNgir gaaw, wax ma sarwiis bi ak dëkk bi.\nSart yi: ñëw 10 minutes lu jiitu, 10% acompte, ngir fommat dafa war 8 heures lu jiitu.`;
    }
    return `Tres bon choix. Reservez ${provider.name} ici: ${link}\n\nPour confirmer vite, dites-moi le service et la ville.\nRegle: arrivez 10 minutes avant, acompte 10%, annulation au moins 8 heures avant.`;
  }

  if (wantsBooking) {
    if (lang === 'en') {
      return 'I can help you book now. Please tell me:\n- What service do you need?\n- When do you want the appointment?\n- Which city are you in?\n\nYou can browse providers here: /barbers.html';
    }
    if (lang === 'wo') {
      return 'Man naa la jappale ngir book leegi. Wax ma:\n- Ban sarwiis nga bëgg?\n- Kañ nga bëgg rendez-vous bi?\n- Ban dëkk nga nekk?\n\nMën nga seet prestataire yi fii: /barbers.html';
    }
    return 'Je peux vous aider a reserver maintenant. Dites-moi:\n- Quel service voulez-vous ?\n- Quand voulez-vous le rendez-vous ?\n- Dans quelle ville etes-vous ?\n\nVous pouvez voir les prestataires ici: /barbers.html';
  }

  if (!hasService || !hasTime || !hasCity) {
    if (lang === 'en') {
      return 'I can help you find and book services on JOTMA.\nTell me the service, preferred date/time, and your city.';
    }
    if (lang === 'wo') {
      return 'Maa ngi ngir jappale la ci JOTMA.\nWax ma sarwiis bi, kañ nga bëgg, ak dëkk bi.';
    }
    return 'Je peux vous aider a trouver et reserver sur JOTMA.\nDites-moi le service, la date/heure souhaitee et votre ville.';
  }

  if (lang === 'en') return 'Tell me the provider name you prefer, and I will guide you to booking.';
  if (lang === 'wo') return 'Wax ma turu prestataire bi nga bëgg, ma gindiko ci booking bi.';
  return 'Dites-moi le nom du prestataire prefere, et je vous guide vers la reservation.';
}

const CTX_PROVIDERS = [
  { id: 1, name: 'Carlos Cuts', aliases: ['carlos', 'carlos cuts'] },
  { id: 2, name: 'Sofia Style Lab', aliases: ['sofia', 'sofia style lab', "sofia's style lab"] },
  { id: 3, name: 'Marcus Fresh Cuts', aliases: ['marcus', 'marcus fresh cuts'] },
];

const CTX_CITIES = [
  'Dakar', 'Thies', 'Diourbel', 'Saint-Louis', 'Louga', 'Matam', 'Tambacounda',
  'Kedougou', 'Kaffrine', 'Kaolack', 'Fatick', 'Kolda', 'Sedhiou', 'Ziguinchor',
];

function ctxNormalizeText(input) {
  return String(input || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ctxDetectProvider(text) {
  const q = ctxNormalizeText(text);
  return CTX_PROVIDERS.find((p) => p.aliases.some((a) => q.includes(ctxNormalizeText(a)))) || null;
}

function ctxDetectCity(text) {
  const q = ctxNormalizeText(text);
  const city = CTX_CITIES.find((c) => q.includes(ctxNormalizeText(c)));
  return city || null;
}

function ctxDetectService(text, lang) {
  const q = ctxNormalizeText(text);
  const map = [
    { rx: /(haircut|cut|coupe|coiffure|fade|degrade|barber)/i, en: 'haircut', fr: 'coupe', wo: 'coupe' },
    { rx: /(beard|barbe|rasage|shave)/i, en: 'beard trim', fr: 'barbe', wo: 'barbe' },
    { rx: /(braid|braids|tresse|tresses)/i, en: 'braids', fr: 'tresses', wo: 'tresses' },
    { rx: /(nails|ongle|manicure|manucure|pedicure)/i, en: 'nails', fr: 'ongles', wo: 'ongles' },
    { rx: /(makeup|maquillage)/i, en: 'makeup', fr: 'maquillage', wo: 'maquillage' },
    { rx: /(massage)/i, en: 'massage', fr: 'massage', wo: 'massage' },
  ];
  const found = map.find((item) => item.rx.test(q));
  if (!found) return null;
  if (lang === 'en') return found.en;
  if (lang === 'wo') return found.wo;
  return found.fr;
}

function ctxDetectWhen(text, lang) {
  const q = ctxNormalizeText(text);
  const hasTomorrow = /\b(tomorrow|demain)\b/i.test(q);
  const hasToday = /\b(today|aujourd)\b/i.test(q);
  const tm = q.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s?(am|pm|h)?\b/);
  const timeText = tm ? tm[0] : '';
  if (!hasTomorrow && !hasToday && !timeText) return null;
  const day = hasTomorrow ? (lang === 'en' ? 'tomorrow' : 'demain') : (hasToday ? (lang === 'en' ? 'today' : "aujourd'hui") : '');
  return (day + ' ' + timeText).trim();
}

function ctxDetectIntent(text, provider) {
  const q = ctxNormalizeText(text);
  if (/(book|booking|appointment|rendez|rdv|reserve|reserver|tekki)/i.test(q)) return true;
  if (/(tomorrow|demain|today|aujourd|am|pm|\d{1,2}:\d{2}|\d{1,2}h)/i.test(q)) return true;
  if (provider && /(with|avec|ak)/i.test(q)) return true;
  return false;
}

function ctxExtract(text, lang) {
  const provider = ctxDetectProvider(text);
  return {
    provider,
    city: ctxDetectCity(text),
    service: ctxDetectService(text, lang),
    when: ctxDetectWhen(text, lang),
    wantsBooking: ctxDetectIntent(text, provider),
  };
}

function ctxMerge(base, next) {
  return {
    provider: base.provider || next.provider || null,
    city: base.city || next.city || null,
    service: base.service || next.service || null,
    when: base.when || next.when || null,
    wantsBooking: !!(base.wantsBooking || next.wantsBooking),
  };
}

function ctxCollect(message, history, lang) {
  let ctx = { provider: null, city: null, service: null, when: null, wantsBooking: false };
  for (const turn of (history || []).slice(-8)) {
    if (!turn || turn.role !== 'user' || !turn.text) continue;
    ctx = ctxMerge(ctx, ctxExtract(turn.text, lang));
  }
  return ctxMerge(ctx, ctxExtract(message, lang));
}

function ctxMissingText(missing, lang) {
  const labels = {
    en: { service: 'service', when: 'date/time', city: 'city' },
    fr: { service: 'service', when: 'date/heure', city: 'ville' },
    wo: { service: 'sarwiis', when: 'date/time', city: 'dekk' },
  };
  const l = labels[lang] || labels.fr;
  const msg = missing.map((k) => l[k]).join(', ');
  if (lang === 'en') return 'I still need: ' + msg + '.';
  if (lang === 'wo') return 'Li ma des mooy: ' + msg + '.';
  return 'Il me manque: ' + msg + '.';
}

function buildContextualFallbackReply(message, lang = 'fr', history = []) {
  const text = String(message || '').trim();
  const q = ctxNormalizeText(text);
  if (!text) {
    return lang === 'en'
      ? 'Tell me the service, preferred date/time, and city.'
      : (lang === 'wo' ? 'Wax ma sarwiis bi, date/time, ak dekk bi.' : 'Dites-moi le service, la date/heure et la ville.');
  }

  if (isOffTopicMessage(q)) return getSupportReply(lang);

  if (/^(hi|hello|hey|bonjour|salut|nanga|salam)/i.test(q)) {
    return lang === 'en'
      ? 'Hello. I can help with booking on JOTMA. Tell me service, date/time, and city.'
      : (lang === 'wo'
        ? 'Nanga def. Maa ngi fi ngir booking JOTMA. Wax ma sarwiis, date/time ak dekk.'
        : 'Bonjour. Je peux aider pour la reservation JOTMA. Donnez service, date/heure et ville.');
  }

  const ctx = ctxCollect(text, history, lang);
  const missing = [];
  if (!ctx.service) missing.push('service');
  if (!ctx.when) missing.push('when');
  if (!ctx.city) missing.push('city');

  if (ctx.provider && ctx.wantsBooking) {
    const link = '/book.html?barber=' + ctx.provider.id;
    if (missing.length === 0) {
      if (lang === 'en') return 'Perfect. Book ' + ctx.provider.name + ': ' + link + '\nService: ' + ctx.service + ' | When: ' + ctx.when + ' | City: ' + ctx.city + '\nPolicy: arrive 10 min early, 10% deposit, cancel at least 8h before.';
      if (lang === 'wo') return 'Baax na. Tekkal ' + ctx.provider.name + ' fii: ' + link + '\nService: ' + ctx.service + ' | Kan: ' + ctx.when + ' | Dekk: ' + ctx.city;
      return 'Parfait. Reservez ' + ctx.provider.name + ' ici: ' + link + '\nService: ' + ctx.service + ' | Quand: ' + ctx.when + ' | Ville: ' + ctx.city + '\nRegle: arrivez 10 min avant, acompte 10%, annulation au moins 8h avant.';
    }
    if (lang === 'en') return 'Great choice: ' + ctx.provider.name + '. Book here: ' + link + '\n' + ctxMissingText(missing, lang);
    if (lang === 'wo') return ctx.provider.name + ' baax na. Tekkal fii: ' + link + '\n' + ctxMissingText(missing, lang);
    return 'Tres bon choix: ' + ctx.provider.name + '. Reservez ici: ' + link + '\n' + ctxMissingText(missing, lang);
  }

  if (ctx.wantsBooking) {
    const params = new URLSearchParams();
    if (ctx.service) params.set('q', ctx.service);
    if (ctx.city) params.set('city', ctx.city);
    const browseLink = params.toString() ? '/barbers.html?' + params.toString() : '/barbers.html';
    if (missing.length === 0) {
      if (lang === 'en') return 'Great. Please choose a provider and book here: ' + browseLink;
      if (lang === 'wo') return 'Baax na. Tannal prestataire te book fii: ' + browseLink;
      return 'Parfait. Choisissez un prestataire et reservez ici: ' + browseLink;
    }
    if (lang === 'en') return ctxMissingText(missing, lang) + '\nYou can browse providers here: ' + browseLink;
    if (lang === 'wo') return ctxMissingText(missing, lang) + '\nMen nga seet prestataire yi fii: ' + browseLink;
    return ctxMissingText(missing, lang) + '\nVous pouvez voir les prestataires ici: ' + browseLink;
  }

  if (lang === 'en') return 'I can help only with JOTMA bookings. Example: "I want a haircut tomorrow at 9am in Dakar."';
  if (lang === 'wo') return 'Maa ngi fi rek ngir booking JOTMA. Misal: "Begg naa coupe demain 9h ci Dakar."';
  return 'Je peux aider uniquement pour les reservations JOTMA. Exemple: "Je veux une coupe demain a 9h a Dakar."';
}

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
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
if (isProduction) {
  const set = new Set(allowedOrigins);
  defaultProdOrigins.forEach((origin) => set.add(normalizeOrigin(origin)));
  const appUrl = normalizeOrigin(process.env.APP_URL || '');
  if (appUrl) {
    set.add(appUrl);
    if (appUrl.includes('://www.')) {
      set.add(appUrl.replace('://www.', '://'));
    } else {
      const [protocol, host] = appUrl.split('://');
      if (protocol && host) set.add(`${protocol}://www.${host}`);
    }
  }
  allowedOrigins.length = 0;
  allowedOrigins.push(...Array.from(set));
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
    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
    console.warn(`CORS denied origin: ${origin}`);
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
const chatLimit = require('express-rate-limit')({ windowMs: 60000, max: 20 });
const handleChat = asyncHandler(async (req, res) => {
  const https = require('https');
  const apiKey = getGeminiApiKey();
  const models = getGeminiModelCandidates();
  const { message, history = [], lang = 'fr' } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Message is required.' });
  if (message.length > 500) return res.status(400).json({ error: 'Message too long.' });
  if (!apiKey) return res.json({ reply: buildContextualFallbackReply(message, lang, history), fallback: true, warning: 'Gemini key missing' });
  const langName = { en: 'English', fr: 'French', wo: 'Wolof' }[lang] || 'French';
  const offTopic = {
    en: "I'm here to help you find and book services on JOTMA.\n\nFor more questions, contact us:\n📞 +1 313 989 6811\n📧 gueyebaye955@gmail.com",
    fr: "Je suis ici pour vous aider à trouver et réserver des services sur JOTMA.\n\nPour plus de questions, contactez-nous :\n📞 +1 313 989 6811\n📧 gueyebaye955@gmail.com",
    wo: "Maa ngi fi ngir la jàpp ci JOTMA.\n\nSu am na laaj, jokkoo ak nun :\n📞 +1 313 989 6811\n📧 gueyebaye955@gmail.com",
  }[lang] || "I'm here to help you find and book services on JOTMA. Contact: +1 313 989 6811 or gueyebaye955@gmail.com";
  const SYSTEM_PROMPT = `Your name is Awa. You are the virtual assistant for JOTMA, a service booking platform in Senegal.

LANGUAGE: Always respond in ${langName} only. Never switch languages.
ROLE: Help users find service providers and book appointments on JOTMA.
STYLE: Keep messages short and simple (2-4 sentences max). Ask follow-up questions when info is missing.

BOOKING FLOW: When a user wants to book, ask for: service needed, preferred date/time, and city.
Known providers: Carlos Cuts (/book.html?barber=1), Sofia Style Lab (/book.html?barber=2), Marcus Fresh Cuts (/book.html?barber=3). For others, direct to /barbers.html.
Booking policy: Arrive 10 min early. 10% deposit required. Cancel up to 8 hours before.

OFF-TOPIC RULE: If the user asks about politics, religion, news, medical, legal, or anything unrelated to JOTMA, respond ONLY with this exact text:
"${offTopic}"`;
  const contents = [];
  for (const turn of history.slice(-6)) {
    if (turn.role && turn.text) {
      contents.push({ role: turn.role, parts: [{ text: String(turn.text).slice(0, 500) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message.trim() }] });
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { maxOutputTokens: 350, temperature: 0.6 },
  });

  let result = null;
  const attempts = [];
  for (const model of models) {
    const candidate = await new Promise((resolve, reject) => {
      const u = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`);
      const req2 = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (r) => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d, model }));
      });
      req2.on('error', reject); req2.write(payload); req2.end();
    });

    attempts.push({ model, status: candidate.status });
    result = candidate;
    if (candidate.status === 200) break;
    if (!shouldTryNextGeminiModel(candidate.status, candidate.body)) break;
  }

  if (!result || result.status !== 200) {
    const bodyText = String(result?.body || '');
    const isBusy = result?.status === 429 || result?.status === 503 || /high demand|unavailable/i.test(bodyText);
    const isQuota = /quota exceeded|rate limit|limit:\s*0/i.test(bodyText);
    console.error('Gemini error:', JSON.stringify({ attempts, body: bodyText.slice(0, 500) }));
    return res.json({
      reply: buildContextualFallbackReply(message, lang, history),
      fallback: true,
      warning: isQuota
        ? 'Gemini quota exceeded'
        : (isBusy ? 'Gemini temporarily busy' : 'Gemini request failed'),
    });
  }

  const data = JSON.parse(result.body);
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, no response generated.';
  res.json({ reply });
});
app.post('/api/chat', chatLimit, handleChat);
app.post('/api/ai', chatLimit, handleChat);

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

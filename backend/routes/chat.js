const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const https = require('https');

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
    'gemini-1.5-flash-latest': 'gemini-1.5-flash',
  };
  return alias[model.toLowerCase()] || model;
}

function getGeminiModels() {
  const configured = normalizeGeminiModel(process.env.GEMINI_MODEL || '');
  const candidates = [configured || 'gemini-2.0-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  return candidates.filter((model, index, arr) => model && arr.indexOf(model) === index);
}

function shouldTryNextModel(statusCode, responseBody) {
  const body = String(responseBody || '').toLowerCase();
  if (statusCode === 404 || statusCode === 429 || statusCode === 503) return true;
  if (body.includes('not found') || body.includes('not supported for generatecontent')) return true;
  if (body.includes('high demand') || body.includes('unavailable')) return true;
  return false;
}

function getSupportReply() {
  return "I'm here to help you find and book services on JOTMA.\n\nFor more questions, please contact us:\n+1 313 989 6811\ngueyebaye955@gmail.com";
}

function isOffTopicMessage(text) {
  const q = String(text || '').toLowerCase();
  return /(politic|religion|news|medical|legal|personal advice)/i.test(q);
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

function buildRuleBasedReply(message) {
  const q = String(message || '').toLowerCase();
  if (!q.trim()) return 'Tell me the service, date/time, and city so I can help you book.';
  if (isOffTopicMessage(q)) return getSupportReply();
  const provider = detectProvider(q);
  const wantsBooking = /(book|booking|appointment|rendez|rdv|reserve|tomorrow|am|pm|\d{1,2}(:\d{2})?)/i.test(q);
  if (provider && wantsBooking) {
    return `Great choice. Book ${provider.name} here: /book.html?barber=${provider.id}\n\nTell me your service and city to confirm.`;
  }
  if (wantsBooking) {
    return 'I can help you book now. Tell me the service, your preferred date/time, and city.\nBrowse providers: /barbers.html';
  }
  return 'I am here to help you find and book services on JOTMA. Tell me what service you need.';
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const chatLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages. Please wait a moment.' },
});

const SYSTEM_PROMPT = `Your name is Baye. You are a helpful AI assistant for the JOTMA platform — a service booking app in Senegal.
You help users find barbers, book appointments, and answer questions about services, pricing, and cancellations.
You can speak English, French, and Wolof. Always respond in the same language the user writes in.
Keep answers short, friendly, and practical (2-4 sentences max).

When a user wants to book with a specific barber, give them the direct booking link using this format:
/book.html?barber=ID
Known barbers and their IDs:
- Carlos / Carlos Cuts → ID 1 → /book.html?barber=1
- Sofia / Sofia's Style Lab → ID 2 → /book.html?barber=2
- Marcus / Marcus Fresh Cuts → ID 3 → /book.html?barber=3
For unknown barbers, send them to /barbers.html to browse and pick one.

Booking policy reminders when relevant:
- Arrive 10 minutes early
- 10% deposit required to confirm
- Cancel or reschedule up to 8 hours before

Never discuss topics unrelated to JOTMA, barbers, bookings, or services in Senegal.
If unsure, suggest the user visit the Support page or contact JOTMA directly.`;

router.post('/', chatLimit, async (req, res) => {
  const apiKey = getGeminiApiKey();
  const models = getGeminiModels();

  const { message, history = [] } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 chars).' });
  }
  if (!apiKey) return res.json({ reply: buildRuleBasedReply(message), fallback: true, warning: 'Gemini key missing' });

  // Build conversation contents for Gemini
  const contents = [];
  for (const turn of history.slice(-6)) { // last 3 exchanges
    if (turn.role && turn.text) {
      contents.push({ role: turn.role, parts: [{ text: String(turn.text).slice(0, 500) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message.trim() }] });

  try {
    let result = null;
    const attempts = [];
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
      const candidate = await httpsPost(url, {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      });
      attempts.push({ model, status: candidate.status });
      result = candidate;
      if (candidate.status === 200) break;
      if (!shouldTryNextModel(candidate.status, candidate.body)) break;
    }

    if (!result || result.status !== 200) {
      const bodyText = String(result?.body || '');
      const isBusy = result?.status === 429 || result?.status === 503 || /high demand|unavailable/i.test(bodyText);
      console.error('Gemini API error:', JSON.stringify({ attempts, body: bodyText.slice(0, 500) }));
      return res.json({
        reply: buildRuleBasedReply(message),
        fallback: true,
        warning: isBusy ? 'Gemini temporarily busy' : 'Gemini request failed',
      });
    }

    const data = JSON.parse(result.body);
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat route error:', err.message);
    res.status(500).json({ error: 'Unable to reach AI service.' });
  }
});

module.exports = router;

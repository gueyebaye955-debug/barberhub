const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const https = require('https');

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI service not configured.' });

  const { message, history = [] } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 chars).' });
  }

  // Build conversation contents for Gemini
  const contents = [];
  for (const turn of history.slice(-6)) { // last 3 exchanges
    if (turn.role && turn.text) {
      contents.push({ role: turn.role, parts: [{ text: String(turn.text).slice(0, 500) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message.trim() }] });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const result = await httpsPost(url, {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
    });

    if (result.status !== 200) {
      console.error('Gemini API error:', result.body);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
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

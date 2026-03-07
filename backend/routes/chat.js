const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const chatLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages. Please wait a moment.' },
});

const SYSTEM_PROMPT = `Your name is Baye. You are a helpful AI assistant for the JOTMA platform — a service booking app in Senegal.
You help users find barbers, understand how to book appointments, answer questions about services, pricing, cancellations, and the platform.
You can speak English, French, and Wolof. Always respond in the same language the user writes in.
Keep answers short, friendly, and practical (2-4 sentences max).
If asked about a specific barber or price, tell the user to browse the Barbers page or the barber's profile for live info.
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Gemini API error:', err);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat route error:', err.message);
    res.status(500).json({ error: 'Unable to reach AI service.' });
  }
});

module.exports = router;

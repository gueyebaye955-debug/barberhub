const https = require('https');
const nodemailer = require('nodemailer');

require('dotenv').config();

let transporter = null;

if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: Number.parseInt(process.env.MAIL_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

function formatText(value) {
  return String(value || '').trim();
}

function cleanPhoneDigits(rawPhone) {
  return String(rawPhone || '').replace(/\D/g, '');
}

function toWhatsAppNumber(rawPhone) {
  const raw = String(rawPhone || '').trim();
  const digits = cleanPhoneDigits(raw);
  if (!digits) return '';
  if (raw.startsWith('+')) return digits;
  if (digits.length === 10) {
    const cc = cleanPhoneDigits(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '1');
    return `${cc || '1'}${digits}`;
  }
  return digits;
}

function buildWhatsAppBookingText(data = {}) {
  const bookingId = data.bookingId ? `#${data.bookingId}` : '';
  const title = bookingId ? `New Jelall booking ${bookingId}` : 'New Jelall booking';
  const lines = [
    title,
    `Service: ${formatText(data.serviceName) || '-'}`,
    `Date: ${formatText(data.date) || '-'}`,
    `Time: ${formatText(data.time) || '-'}`,
    `Customer: ${formatText(data.customerName) || '-'}`,
  ];
  const customerPhone = formatText(data.customerPhone);
  const customerEmail = formatText(data.customerEmail);
  const notes = formatText(data.notes);
  if (customerPhone) lines.push(`Customer phone: ${customerPhone}`);
  if (customerEmail) lines.push(`Customer email: ${customerEmail}`);
  if (notes) lines.push(`Notes: ${notes}`);
  return lines.join('\n');
}

function buildWhatsAppLink(rawPhone, text) {
  const to = toWhatsAppNumber(rawPhone);
  if (!to) return '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

function postJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const req = https.request({
      method: 'POST',
      protocol: target.protocol,
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode || 0, body: text });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendCode(toEmail, code) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Jelall <noreply@jelall.com>',
      to: toEmail,
      subject: 'Jelall - Your verification code',
      text: `Your verification code is: ${code}\n\nExpires in 10 minutes.`,
      html: `<p>Your Jelall verification code is:</p>
             <h2 style="letter-spacing:0.4rem">${code}</h2>
             <p>Expires in 10 minutes.</p>`,
    });
    return true;
  } catch (err) {
    console.error('Mail error:', err.message);
    return false;
  }
}

async function sendMail(toEmail, subject, text) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Jelall <noreply@jelall.com>',
      to: toEmail,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('Mail error:', err.message);
    return false;
  }
}

async function sendBookingEmail(type, toEmail, data) {
  if (!transporter) return false;
  const from = process.env.MAIL_FROM || 'Jelall <noreply@jelall.com>';
  const base = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#111;color:#eee;border-radius:12px;overflow:hidden">
      <div style="background:#e94560;padding:1.2rem 2rem">
        <h1 style="margin:0;font-size:1.4rem;color:#fff">Jelall</h1>
      </div>
      <div style="padding:1.5rem 2rem">`;
  const footer = `</div><div style="background:#1a1a2e;padding:0.8rem 2rem;font-size:0.75rem;color:#888">
        Jelall - <a href="https://barberhub-production.up.railway.app" style="color:#e94560">Open app</a>
      </div></div>`;

  const customerPhoneRow = data.customerPhone
    ? `<tr><td style="padding:0.4rem 0;color:#aaa">Customer phone</td><td><strong>${data.customerPhone}</strong></td></tr>`
    : '';
  const customerEmailRow = data.customerEmail
    ? `<tr><td style="padding:0.4rem 0;color:#aaa">Customer email</td><td><strong>${data.customerEmail}</strong></td></tr>`
    : '';
  const notesRow = data.notes
    ? `<tr><td style="padding:0.4rem 0;color:#aaa">Notes</td><td><strong>${data.notes}</strong></td></tr>`
    : '';

  const templates = {
    new_booking: {
      subject: `New booking: ${data.serviceName} on ${data.date}`,
      html: `${base}
        <h2 style="color:#e94560;margin-top:0">New Booking!</h2>
        <p>You have a new appointment:</p>
        <table style="width:100%;border-collapse:collapse;margin:1rem 0">
          <tr><td style="padding:0.4rem 0;color:#aaa">Customer</td><td><strong>${data.customerName}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Service</td><td><strong>${data.serviceName}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Date</td><td><strong>${data.date}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Time</td><td><strong>${data.time}</strong></td></tr>
          ${customerPhoneRow}
          ${customerEmailRow}
          ${notesRow}
        </table>
        <p style="color:#aaa;font-size:0.85rem">Log in to your dashboard to confirm or manage this booking.</p>
        ${footer}`,
    },
    booking_confirmed: {
      subject: `Booking confirmed: ${data.serviceName} on ${data.date}`,
      html: `${base}
        <h2 style="color:#10b981;margin-top:0">Booking Confirmed</h2>
        <p>Your appointment has been confirmed:</p>
        <table style="width:100%;border-collapse:collapse;margin:1rem 0">
          <tr><td style="padding:0.4rem 0;color:#aaa">Barber</td><td><strong>${data.barberName}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Service</td><td><strong>${data.serviceName}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Date</td><td><strong>${data.date}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Time</td><td><strong>${data.time}</strong></td></tr>
        </table>
        <p style="color:#aaa;font-size:0.85rem">See you soon!</p>
        ${footer}`,
    },
    booking_cancelled: {
      subject: `Booking cancelled: ${data.serviceName} on ${data.date}`,
      html: `${base}
        <h2 style="color:#f59e0b;margin-top:0">Booking Cancelled</h2>
        <p>A booking has been cancelled:</p>
        <table style="width:100%;border-collapse:collapse;margin:1rem 0">
          <tr><td style="padding:0.4rem 0;color:#aaa">Service</td><td><strong>${data.serviceName}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Date</td><td><strong>${data.date}</strong></td></tr>
          <tr><td style="padding:0.4rem 0;color:#aaa">Time</td><td><strong>${data.time}</strong></td></tr>
        </table>
        ${footer}`,
    },
  };

  const tmpl = templates[type];
  if (!tmpl) return false;
  try {
    await transporter.sendMail({ from, to: toEmail, subject: tmpl.subject, html: tmpl.html });
    return true;
  } catch (err) {
    console.error('Booking email error:', err.message);
    return false;
  }
}

async function sendWhatsAppBookingAlert(toPhone, data = {}) {
  const text = buildWhatsAppBookingText(data);
  const link = buildWhatsAppLink(toPhone, text);
  if (!link) return { ok: false, reason: 'missing_phone', link: '' };

  const accessToken = formatText(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = formatText(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const graphVersion = formatText(process.env.WHATSAPP_GRAPH_VERSION || 'v20.0');
  if (!accessToken || !phoneNumberId) {
    return { ok: false, reason: 'not_configured', link };
  }

  try {
    const response = await postJson(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWhatsAppNumber(toPhone),
        type: 'text',
        text: { body: text },
      },
      { Authorization: `Bearer ${accessToken}` }
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error('WhatsApp API error:', response.statusCode, response.body.slice(0, 300));
      return { ok: false, reason: 'api_error', link };
    }
    return { ok: true, reason: 'sent', link };
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { ok: false, reason: 'send_failed', link };
  }
}

module.exports = {
  sendCode,
  sendMail,
  sendBookingEmail,
  sendWhatsAppBookingAlert,
  buildWhatsAppBookingText,
  buildWhatsAppLink,
};

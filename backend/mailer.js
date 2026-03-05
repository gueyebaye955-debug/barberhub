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

async function sendCode(toEmail, code) {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'BarberHub <noreply@barberhub.com>',
      to: toEmail,
      subject: 'BarberHub - Your verification code',
      text: `Your verification code is: ${code}\n\nExpires in 10 minutes.`,
      html: `<p>Your BarberHub verification code is:</p>
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
      from: process.env.MAIL_FROM || 'BarberHub <noreply@barberhub.com>',
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
  const from = process.env.MAIL_FROM || 'BarberHub <noreply@barberhub.com>';
  const base = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#111;color:#eee;border-radius:12px;overflow:hidden">
      <div style="background:#e94560;padding:1.2rem 2rem">
        <h1 style="margin:0;font-size:1.4rem;color:#fff">✂️ BarberHub</h1>
      </div>
      <div style="padding:1.5rem 2rem">`;
  const footer = `</div><div style="background:#1a1a2e;padding:0.8rem 2rem;font-size:0.75rem;color:#888">
        © BarberHub · <a href="https://barberhub-production.up.railway.app" style="color:#e94560">Open app</a>
      </div></div>`;

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
        </table>
        <p style="color:#aaa;font-size:0.85rem">Log in to your dashboard to confirm or manage this booking.</p>
        ${footer}`,
    },
    booking_confirmed: {
      subject: `Booking confirmed: ${data.serviceName} on ${data.date}`,
      html: `${base}
        <h2 style="color:#10b981;margin-top:0">✅ Booking Confirmed!</h2>
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

module.exports = { sendCode, sendMail, sendBookingEmail };

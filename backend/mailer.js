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

module.exports = { sendCode, sendMail };

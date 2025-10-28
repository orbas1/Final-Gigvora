const nodemailer = require('nodemailer');
const config = require('../config');

let transporter;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

const sendMail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    console.log('Email (mock):', { to, subject, text, html });
    return;
  }
  await transporter.sendMail({ from: config.email.from, to, subject, text, html });
};

module.exports = { sendMail };

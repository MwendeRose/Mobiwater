const nodemailer = require("nodemailer");
const AfricasTalking = require("africastalking");

// EMAIL
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL_FROM,
    pass: process.env.ALERT_EMAIL_PASSWORD,
  },
});

// SMS
const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

async function sendEmail(subject, text) {
  if (!process.env.ALERT_EMAIL_FROM) return;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.ALERT_EMAIL_TO,
    subject,
    text,
  });
}

async function sendSMS(message) {
  if (!process.env.AT_API_KEY) return;

  await at.SMS.send({
    to: [process.env.ALERT_PHONE_TO],
    message,
  });
}

module.exports = { sendEmail, sendSMS };
const nodemailer = require("nodemailer");
const AfricasTalking = require("africastalking");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL_FROM,
    pass: process.env.ALERT_EMAIL_PASSWORD,
  },
});


const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = at.SMS;


async function sendEmail(subject, message) {
  if (!process.env.ALERT_EMAIL_FROM) {
    console.log("Email not configured");
    return;
  }

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.ALERT_EMAIL_TO,
    subject,
    text: message,
  });

  console.log(" Email sent");
}

async function sendSMS(message) {
  if (!process.env.AT_API_KEY) {
    console.log("SMS not configured");
    return;
  }

  await sms.send({
    to: [process.env.ALERT_PHONE_TO],
    message,
  });

  console.log("📱 SMS sent");
}

module.exports = { sendEmail, sendSMS };
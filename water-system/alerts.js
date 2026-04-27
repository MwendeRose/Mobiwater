const thresholds = require("./thresholds");
const nodemailer = require("nodemailer");
const AfricasTalking = require("africastalking");

// Email setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL_FROM,
    pass: process.env.ALERT_EMAIL_PASSWORD,
  },
});

// SMS setup
const atClient = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

let lastLevels = {};

async function sendEmail(subject, message) {
  if (!process.env.ALERT_EMAIL_FROM) return;

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_FROM,
    to: process.env.ALERT_EMAIL_TO,
    subject,
    text: message,
  });
}

async function sendSMS(message) {
  if (!process.env.AT_API_KEY) return;

  await atClient.SMS.send({
    to: [process.env.ALERT_PHONE_TO],
    message,
  });
}

exports.checkAlerts = async (tank) => {
  const prev = lastLevels[tank.id];

  // 🔻 LOW LEVEL ALERT
  if (tank.level < thresholds.MIN_LEVEL) {
    const msg = `⚠️ Tank ${tank.id} low: ${tank.level}%`;

    console.log(msg);
    await sendEmail("Low Tank Alert", msg);
    await sendSMS(msg);
  }

  // 💧 LEAK DETECTION
  if (prev !== undefined) {
    const drop = prev - tank.level;

    if (drop > thresholds.MAX_DROP) {
      const msg = `🚨 Leak detected on tank ${tank.id}`;

      console.log(msg);
      await sendEmail("Leak Alert", msg);
      await sendSMS(msg);
    }
  }

  lastLevels[tank.id] = tank.level;
};
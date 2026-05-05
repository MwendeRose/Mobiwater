const { sendEmail, sendSMS } = require("./models/notifications");

const lastAlerts = new Map();

function canSend(key, cooldownMs = 10 * 60 * 1000) {
  const last = lastAlerts.get(key);
  const now = Date.now();

  if (!last || now - last > cooldownMs) {
    lastAlerts.set(key, now);
    return true;
  }

  return false;
}

async function triggerAlert({ type, title, message, key }) {
  try {
    if (key && !canSend(key)) return;

    console.log(`[${type}] ${message}`);

    await sendEmail(title, message);
    await sendSMS(`${title}: ${message}`);

  } catch (err) {
    console.error("Alert error:", err.message);
  }
}

module.exports = { triggerAlert };
const { sendEmail, sendSMS } = require("./models/notifications");

const lastAlerts = new Map();
const tankMemory = new Map();

function canSend(key, cooldownMs = 10 * 60 * 1000) {
  const last = lastAlerts.get(key);
  const now = Date.now();

  if (!last || now - last > cooldownMs) {
    lastAlerts.set(key, now);
    return true;
  }
  return false;
}

function formatNumber(n) {
  return Number(n ?? 0).toFixed(1);
}

function formatTime(date) {
  if (!date) return "unknown";

  return new Date(date).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * MAIN ALERT FUNCTION
 */
async function triggerAlert({ type, title, message, key }) {
  try {
    if (key && !canSend(key)) return;

    console.log(`[${type}]`, message);

    let emailBody;

    if (typeof message === "object") {
      const {
        tankId,
        tankName,
        currentVolume,
        percentage,
        lastReadAt,
      } = message;

      const id = `tank_${tankId}`;

      const prev = tankMemory.get(id) || {
        initialVolume: currentVolume,
        lastVolume: currentVolume,
      };

      const changeFromLast = currentVolume - prev.lastVolume;
      const totalChange = currentVolume - prev.initialVolume;

      // update memory
      tankMemory.set(id, {
        initialVolume: prev.initialVolume,
        lastVolume: currentVolume,
      });

      emailBody = `
TANK ALERT: ${tankName}

Current Level: ${percentage}% (${formatNumber(currentVolume)} L)
Initial Reading: ${formatNumber(prev.initialVolume)} L
Last Reading: ${formatNumber(prev.lastVolume)} L

Change since last: ${formatNumber(changeFromLast)} L
Total change: ${formatNumber(totalChange)} L

Last updated: ${formatTime(lastReadAt)}

⚠ Risk Alert: Immediate attention required
      `.trim();
    }


    else {
      emailBody = `${message}`;
    }

    await sendEmail(title, emailBody);
    await sendSMS(
      `${title}: ${
        typeof message === "string" ? message : "Tank alert triggered"
      }`
    );
  } catch (err) {
    console.error("Alert error:", err.message);
  }
}

module.exports = { triggerAlert };
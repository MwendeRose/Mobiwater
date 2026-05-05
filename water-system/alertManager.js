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


function timeAgo(date) {
  if (!date) return "unknown time";

  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "just now";
  return `${mins} min${mins !== 1 ? "s" : ""} ago`;
}

async function triggerAlert({ type, title, message, key }) {
  try {
    if (key && !canSend(key)) return;

    console.log(`[${type}]`, message);

    let emailBody;

    if (typeof message === "object") {
      const {
        tankName,
        currentVolume,
        previousVolume,
        initialVolume,
        percentage,
        lastReadAt,
      } = message;

      const changeFromPrev =
        previousVolume != null
          ? currentVolume - previousVolume
          : 0;

      const changeFromInitial =
        initialVolume != null
          ? currentVolume - initialVolume
          : 0;

      emailBody = `
        <div style="font-family:Arial; padding:10px;">
          <h2 style="color:#b91c1c;">${tankName} Alert</h2>

          <p><b>Current Reading:</b> ${currentVolume} L (${percentage}%)</p>

          <p><b>Previous Reading:</b> ${previousVolume ?? "N/A"} L</p>

          <p><b>Initial Reading:</b> ${initialVolume ?? "N/A"} L</p>

          <hr/>

          <p><b>Change from last reading:</b> ${changeFromPrev} L</p>

          <p><b>Total change since start:</b> ${changeFromInitial} L</p>

          <p><b>Last updated:</b> ${timeAgo(lastReadAt)}</p>

          <hr/>

          <p style="color:#dc2626;">
            ⚠ Risk Alert: Tank condition requires attention immediately.
          </p>
        </div>
      `;
    } else {
      emailBody = `<p>${message}</p>`;
    }

    await sendEmail(title, emailBody);
    await sendSMS(
      `${title}: ${
        typeof message === "string"
          ? message
          : "Tank alert triggered"
      }`
    );
  } catch (err) {
    console.error("Alert error:", err.message);
  }
}

module.exports = { triggerAlert };
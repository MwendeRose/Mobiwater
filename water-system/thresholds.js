// thresholds.js
const { sendEmail, sendSMS } = require("./alerts");

// Track who has already been warned today to avoid repeat alerts
const warnedToday = new Set();

// Reset warnings at midnight
function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    warnedToday.clear();
    console.log("🔄 Threshold warnings reset for new day");
    scheduleMidnightReset(); // schedule again for next midnight
  }, msUntilMidnight);
}

scheduleMidnightReset();

// ─────────────────────────────────────────
// Check meters against their consumption threshold
// ─────────────────────────────────────────
async function checkConsumptionThresholds(meters) {
  for (const meter of meters) {
    const daily = meter.dailyConsumption || 0;
    const threshold = meter.consumptionThreshold || 0;
    const name = meter.flowDeviceName;
    const id = meter.flowDeviceId;

    if (threshold <= 0) continue; // no threshold set, skip

    const pct = (daily / threshold) * 100;

    // Warn at 80% of threshold
    if (pct >= 80 && pct < 100 && !warnedToday.has(`warn_${id}`)) {
      warnedToday.add(`warn_${id}`);
      const msg = `Meter "${name}" has used ${daily.toFixed(1)}L today — ${Math.round(pct)}% of its ${threshold}L daily threshold.`;
      console.log(`⚠️  Threshold warning: ${msg}`);
      await sendEmail(`Consumption Warning: ${name}`, msg);
      await sendSMS(msg);
    }

    // Alert at 100%+ of threshold
    if (pct >= 100 && !warnedToday.has(`exceeded_${id}`)) {
      warnedToday.add(`exceeded_${id}`);
      const msg = `EXCEEDED: Meter "${name}" has used ${daily.toFixed(1)}L — ${Math.round(pct)}% of its ${threshold}L daily threshold!`;
      console.log(`🚨 Threshold exceeded: ${msg}`);
      await sendEmail(`Threshold EXCEEDED: ${name}`, msg);
      await sendSMS(msg);
    }
  }
}

module.exports = { checkConsumptionThresholds };
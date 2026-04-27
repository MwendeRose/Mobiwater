const { sendEmail, sendSMS } = require("./models/notifications");

const warned = new Set();

async function checkConsumptionThresholds(meters) {
  for (const m of meters) {
    const daily = m.dailyConsumption || 0;
    const limit = m.consumptionThreshold || 0;

    if (!limit) continue;

    const pct = (daily / limit) * 100;

    if (pct >= 80 && !warned.has(m.flowDeviceId)) {
      warned.add(m.flowDeviceId);

      const msg = `⚠️ ${m.flowDeviceName} at ${Math.round(pct)}%`;
      await sendEmail("Usage Warning", msg);
      await sendSMS(msg);
    }
  }
}

module.exports = { checkConsumptionThresholds };
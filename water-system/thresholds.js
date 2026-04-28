const { triggerAlert } = require("./alertManager");

const warned = new Set();

async function checkConsumptionThresholds(meters) {
  for (const m of meters) {
    const pct =
      (m.dailyConsumption / m.consumptionThreshold) * 100;

    // 📉 HIGH DAILY USAGE
    if (pct >= 80 && pct < 100) {
      await triggerAlert({
        type: "USAGE_HIGH",
        title: "High Water Usage",
        message: `${m.flowDeviceName} is at ${Math.round(pct)}% daily usage`,
        key: `usage_warn_${m.flowDeviceId}`,
      });
    }

    // 🚨 EXCEEDED
    if (pct >= 100) {
      await triggerAlert({
        type: "USAGE_EXCEEDED",
        title: "Water Limit Exceeded",
        message: `${m.flowDeviceName} exceeded daily limit`,
        key: `usage_exceed_${m.flowDeviceId}`,
      });
    }
  }
}

module.exports = { checkConsumptionThresholds };
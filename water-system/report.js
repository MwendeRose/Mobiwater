// report.js
const cron = require("node-cron");
const {
  getDailyConsumptionSummary,
  getLatestTankReadings
} = require("./db");

// 📊 Generate and send daily report
async function sendDailyReport() {
  try {
    const tanks = await getLatestTankReadings();
    const meters = await getDailyConsumptionSummary();

    console.log("📊 DAILY REPORT");

    // Tank summary
    tanks.forEach(t => {
      console.log(
        `Tank ${t.tankId}: ${t.waterLevelPercentage}% (${t.tankState})`
      );
    });

    // Meter summary
    meters.forEach(m => {
      console.log(
        `Meter ${m._id}: ${m.maxConsumption}L (Threshold: ${m.consumptionThreshold})`
      );
    });

    console.log("✅ Report generated successfully");
  } catch (err) {
    console.error("❌ Report error:", err.message);
  }
}

// ⏱ Schedule (optional if already in index.js)
cron.schedule(
  "0 7 * * *",
  () => {
    console.log("📄 Running scheduled report...");
    sendDailyReport();
  },
  { timezone: "Africa/Nairobi" }
);

module.exports = { sendDailyReport };
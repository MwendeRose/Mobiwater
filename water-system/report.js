const { getDailyConsumptionSummary, getLatestTankReadings } = require("./db");

async function sendDailyReport() {
  try {
    const tanks = await getLatestTankReadings();
    const meters = await getDailyConsumptionSummary();

    console.log("\n DAILY REPORT");

    // Tanks
    tanks.forEach(t => {
      console.log(
        `Tank ${t.tankId}: ${t.waterLevelPercentage}% (${t.tankState})`
      );
    });

    // Meters
    meters.forEach(m => {
      console.log(
        `Meter ${m._id}: ${m.maxConsumption}L (Threshold: ${m.consumptionThreshold})`
      );
    });

    console.log(" Report generated\n");
  } catch (err) {
    console.error(" Report error:", err.message);
  }
}

module.exports = { sendDailyReport };
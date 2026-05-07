const { triggerAlert } = require("./alertmanager");

async function runPredictiveChecks(tanks, meters) {
  const refillAlerts = [];
  const trendAlerts = [];
  const leakAlerts = [];

  for (const tank of tanks) {
    const data = tank.lastReceivedTankData;
    if (!data) continue;

    const pct = data.waterLevelPercentage || 0;

    if (pct > 10 && pct < 20) {
      await triggerAlert({
        type: "PREDICTIVE_WARNING",
        title: `Predictive Alert: ${tank.tankName}`,
        message: `${tank.tankName} may become low soon.`,
        key: `pred_${tank.tankId}`,
        data: { pct },
      });

      refillAlerts.push({
        tankId: tank.tankId,
        percent: pct,
      });
    }
  }

  return {
    refillAlerts,
    trendAlerts,
    leakAlerts,
  };
}

module.exports = { runPredictiveChecks };
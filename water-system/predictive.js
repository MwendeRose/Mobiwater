async function runPredictiveChecks() {
  return {
    refillAlerts: [],
    trendAlerts: [],
    leakAlerts: [],
  };
}

async function sendRefillSchedule() {
  console.log("[PREDICTIVE] refill schedule running");
}

async function sendBillingReport() {
  console.log("[PREDICTIVE] billing running");
}

module.exports = {
  runPredictiveChecks,
  sendRefillSchedule,
  sendBillingReport,
};
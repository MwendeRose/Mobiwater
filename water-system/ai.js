// ai.js

exports.analyzeSystem = (tanks, meters) => {
  let messages = [];

  // Tank analysis
  tanks.forEach(t => {
    const level = t.lastReceivedTankData?.waterLevelPercentage || 0;

    if (level < 20) {
      messages.push(`⚠️ Tank ${t.tankId} low (${level}%)`);
    }
  });

  // Meter analysis
  meters.forEach(m => {
    const flow = m.lastReceivedFlowData?.measuredFlowRate || 0;

    if (flow > 50) {
      messages.push(`🚨 High flow on meter ${m.flowDeviceId}`);
    }
  });

  if (messages.length === 0) {
    return "✅ System normal";
  }

  return messages.join(" | ");
};
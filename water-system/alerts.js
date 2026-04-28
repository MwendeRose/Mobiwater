const { triggerAlert } = require("./alertmanager");

async function checkAndSendAlerts(tanks, meters, previousStates = {}) {
  const triggered = [];

  for (const tank of tanks) {
    const id = `tank_${tank.tankId}`;
    const data = tank.lastReceivedTankData;

    if (!data) continue;

    const pct = data.waterLevelPercentage;
    const state = data.tankState;


    if (pct <= 10) {
      await triggerAlert({
        type: "TANK_CRITICAL",
        title: `Tank Critical: ${tank.tankName}`,
        message: `${tank.tankName} is at ${pct}% capacity (${data.actualWaterVolume}L). Immediate refill needed.`,
        key: `${id}_critical`,
      });
      triggered.push({ id, type: "TANK_CRITICAL", pct });
    }

  
    else if (state === "LOW") {
      await triggerAlert({
        type: "TANK_LOW",
        title: ` Tank Low: ${tank.tankName}`,
        message: `${tank.tankName} is at ${pct}% capacity (${data.actualWaterVolume}L).`,
        key: `${id}_low`,
      });
      triggered.push({ id, type: "TANK_LOW", pct });
    }

    if (state === "HIGH" && pct >= 98) {
      await triggerAlert({
        type: "TANK_OVERFLOW",
        title: `💧 Tank Near Overflow: ${tank.tankName}`,
        message: `${tank.tankName} is at ${pct}% — risk of overflow.`,
        key: `${id}_overflow`,
      });
      triggered.push({ id, type: "TANK_OVERFLOW", pct });
    }

    // 📡 Hardware offline
    if (tank.hardwareState === "OFFLINE") {
      await triggerAlert({
        type: "TANK_OFFLINE",
        title: ` Tank Offline: ${tank.tankName}`,
        message: `${tank.tankName} hardware is OFFLINE. Check device connection.`,
        key: `${id}_offline`,
      });
      triggered.push({ id, type: "TANK_OFFLINE" });
    }
  }

  
  for (const meter of meters) {
    const id = `meter_${meter.flowDeviceId}`;
    const data = meter.lastReceivedFlowData;

    if (!data) continue;

    const state = data.flowDeviceState;
    const daily = meter.dailyConsumption;
    const threshold = meter.consumptionThreshold;


    if (threshold && daily > threshold) {
      await triggerAlert({
        type: "METER_OVERCONSUMPTION",
        title: ` High Consumption: ${meter.flowDeviceName}`,
        message: `${meter.flowDeviceName} daily usage is ${daily}L — exceeds limit of ${threshold}L.`,
        key: `${id}_overconsumption`,
      });
      triggered.push({ id, type: "METER_OVERCONSUMPTION", daily, threshold });
    }

    if (state && state !== "NORMAL") {
      await triggerAlert({
        type: "METER_ABNORMAL",
        title: ` Meter Abnormal: ${meter.flowDeviceName}`,
        message: `${meter.flowDeviceName} flow state is ${state}.`,
        key: `${id}_abnormal`,
      });
      triggered.push({ id, type: "METER_ABNORMAL", state });
    }

    // 📡 Hardware offline
    if (meter.hardwareState === "OFFLINE") {
      await triggerAlert({
        type: "METER_OFFLINE",
        title: `📡 Meter Offline: ${meter.flowDeviceName}`,
        message: `${meter.flowDeviceName} hardware is OFFLINE. Check device connection.`,
        key: `${id}_offline`,
      });
      triggered.push({ id, type: "METER_OFFLINE" });
    }
  }

  return triggered;
}

module.exports = { checkAndSendAlerts };
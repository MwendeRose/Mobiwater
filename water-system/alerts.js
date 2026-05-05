const { triggerAlert } = require("./alertmanager");

const tankMemory = new Map();
const lastAlerts = new Map();

/* ───────────── helpers ───────────── */

function canSend(key, cooldownMs = 10 * 60 * 1000) {
  const last = lastAlerts.get(key);
  const now = Date.now();

  if (!last || now - last > cooldownMs) {
    lastAlerts.set(key, now);
    return true;
  }
  return false;
}

function formatExactTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/* ───────────── LEVEL LOGIC (YOUR RULES) ───────────── */

function classifyLevel(pct) {
  if (pct <= 15) return "CRITICAL";
  if (pct <= 40) return "LOW";
  if (pct <= 85) return "NORMAL";
  if (pct <= 95) return "HIGH";
  return "OVERFLOW_RISK";
}

/* ───────────── MAIN ALERT ENGINE ───────────── */

async function checkAndSendAlerts(tanks, meters = []) {
  const triggered = [];

  for (const tank of tanks) {
    const id = `tank_${tank.tankId}`;
    const data = tank.lastReceivedTankData;

    if (!data) continue;

    const pct = data.waterLevelPercentage;
    const volume = data.actualWaterVolume;
    const now = Date.now();

    const level = classifyLevel(pct);

    /* ───── MEMORY TRACKING ───── */

    const prev = tankMemory.get(id);

    const memory = prev || {
      initialVolume: volume,
      lastVolume: volume,
      lastPct: pct,
      lastTime: now,
    };

    const diffFromLast = memory.lastVolume - volume;
    const totalDrop = memory.initialVolume - volume;

    tankMemory.set(id, {
      initialVolume: memory.initialVolume,
      lastVolume: volume,
      lastPct: pct,
      lastTime: now,
    });

    /* ───── CLEAN MESSAGE (EMAIL FRIENDLY) ───── */

    const message = `
Tank: ${tank.tankName}

Current Level: ${pct}% (${volume} L)

Initial Reading: ${memory.initialVolume} L
Last Reading: ${memory.lastVolume} L

Change since last: ${diffFromLast.toFixed(1)} L
Total drop: ${totalDrop.toFixed(1)} L

Last updated: ${formatExactTime(now)}
    `.trim();

    /* ───── ALERT RULES ───── */

    if (level === "CRITICAL" && canSend(`${id}_critical`)) {
      await triggerAlert({
        type: "TANK_CRITICAL",
        title: `CRITICAL: ${tank.tankName}`,
        message,
        key: `${id}_critical`,
      });
      triggered.push({ id, level, pct });
    }

    if (level === "LOW" && canSend(`${id}_low`)) {
      await triggerAlert({
        type: "TANK_LOW",
        title: `LOW: ${tank.tankName}`,
        message,
        key: `${id}_low`,
      });
      triggered.push({ id, level, pct });
    }

    if (level === "HIGH" && canSend(`${id}_high`)) {
      await triggerAlert({
        type: "TANK_HIGH",
        title: `HIGH: ${tank.tankName}`,
        message,
        key: `${id}_high`,
      });
      triggered.push({ id, level, pct });
    }

    if (level === "OVERFLOW_RISK" && canSend(`${id}_overflow`)) {
      await triggerAlert({
        type: "TANK_OVERFLOW",
        title: `OVERFLOW RISK: ${tank.tankName}`,
        message,
        key: `${id}_overflow`,
      });
      triggered.push({ id, level, pct });
    }

    if (tank.hardwareState === "OFFLINE" && canSend(`${id}_offline`)) {
      await triggerAlert({
        type: "TANK_OFFLINE",
        title: `OFFLINE: ${tank.tankName}`,
        message: `${tank.tankName} is offline. Last reading: ${pct}%`,
        key: `${id}_offline`,
      });
      triggered.push({ id, type: "OFFLINE" });
    }
  }

  /* ───── METER ALERTS ───── */

  for (const meter of meters) {
    const id = `meter_${meter.flowDeviceId}`;
    const data = meter.lastReceivedFlowData;

    if (!data) continue;

    const state = data.flowDeviceState;
    const daily = meter.dailyConsumption || 0;
    const threshold = meter.consumptionThreshold;

    if (threshold && daily > threshold && canSend(`${id}_over`)) {
      await triggerAlert({
        type: "METER_OVERCONSUMPTION",
        title: `HIGH USAGE: ${meter.flowDeviceName}`,
        message: `${meter.flowDeviceName} used ${daily}L today (limit ${threshold}L)`,
        key: `${id}_over`,
      });
      triggered.push({ id, type: "OVERCONSUMPTION" });
    }

    if (state && state !== "NORMAL" && canSend(`${id}_abnormal`)) {
      await triggerAlert({
        type: "METER_ABNORMAL",
        title: `ABNORMAL: ${meter.flowDeviceName}`,
        message: `${meter.flowDeviceName} state: ${state}`,
        key: `${id}_abnormal`,
      });
      triggered.push({ id, type: "ABNORMAL" });
    }

    if (meter.hardwareState === "OFFLINE" && canSend(`${id}_offline`)) {
      await triggerAlert({
        type: "METER_OFFLINE",
        title: `OFFLINE: ${meter.flowDeviceName}`,
        message: `${meter.flowDeviceName} is offline`,
        key: `${id}_offline`,
      });
      triggered.push({ id, type: "OFFLINE" });
    }
  }

  return triggered;
}

module.exports = { checkAndSendAlerts };
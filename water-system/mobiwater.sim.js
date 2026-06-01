const TANK_SEEDS = [
  { tankId: 1, tankName: "Rooftop Tank A", tankLocation: "Block A - Floor 6", capacity: 5000, hardwareState: "ONLINE", _baseLevel: 72, _drift: -0.8, _scenario: "normal" },
  { tankId: 2, tankName: "Ground Tank B", tankLocation: "Block B - Basement", capacity: 10000, hardwareState: "ONLINE", _baseLevel: 38, _drift: -1.2, _scenario: "low" },
  { tankId: 3, tankName: "Elevated Tank C", tankLocation: "Block C - Roof", capacity: 3000, hardwareState: "ONLINE", _baseLevel: 12, _drift: -0.5, _scenario: "critical" },
  { tankId: 4, tankName: "Reserve Tank D", tankLocation: "Block D - Ground", capacity: 8000, hardwareState: "OFFLINE", _baseLevel: 55, _drift: 0, _scenario: "offline" },
];
const METER_SEEDS = [
  { flowDeviceId: 101, flowDeviceName: "Main Inlet Meter", flowDeviceLocation: "Block A - Ground Floor", consumptionThreshold: 800, hardwareState: "ONLINE", _baseFlow: 45, _dailyBase: 320, _scenario: "normal" },
  { flowDeviceId: 102, flowDeviceName: "North Wing Meter", flowDeviceLocation: "Block B - North", consumptionThreshold: 600, hardwareState: "ONLINE", _baseFlow: 78, _dailyBase: 650, _scenario: "overconsumption" },
  { flowDeviceId: 103, flowDeviceName: "South Gate Meter", flowDeviceLocation: "Block C - South", consumptionThreshold: 500, hardwareState: "ONLINE", _baseFlow: 30, _dailyBase: 210, _scenario: "normal" },
  { flowDeviceId: 104, flowDeviceName: "East Feed Meter", flowDeviceLocation: "Block D - East", consumptionThreshold: 700, hardwareState: "ONLINE", _baseFlow: 55, _dailyBase: 410, _scenario: "abnormal" },
  { flowDeviceId: 105, flowDeviceName: "West Loop Meter", flowDeviceLocation: "Block E - West", consumptionThreshold: 400, hardwareState: "OFFLINE", _baseFlow: 0, _dailyBase: 0, _scenario: "offline" },
];
const _tankState = {};
const _meterState = {};
function _initState() {
  for (const t of TANK_SEEDS) { if (!_tankState[t.tankId]) _tankState[t.tankId] = { level: t._baseLevel }; }
  for (const m of METER_SEEDS) { if (!_meterState[m.flowDeviceId]) _meterState[m.flowDeviceId] = { daily: m._dailyBase }; }
}
function _noise(range = 5) { return (Math.random() - 0.5) * range; }
function _clamp(val, min, max) { return Math.min(max, Math.max(min, val)); }
function _tankStateLabel(pct) {
  if (pct <= 15) return "CRITICAL";
  if (pct <= 40) return "LOW";
  if (pct <= 85) return "NORMAL";
  if (pct <= 95) return "HIGH";
  return "OVERFLOW_RISK";
}
async function getTanks() {
  _initState();
  return TANK_SEEDS.map((seed) => {
    const state = _tankState[seed.tankId];
    state.level = _clamp(state.level + seed._drift + _noise(2), 0, 100);
    const pct = +state.level.toFixed(2);
    const volume = +((pct / 100) * seed.capacity).toFixed(1);
    const levelMeters = +((pct / 100) * 4).toFixed(3);
    return {
      tankId: seed.tankId, tankName: seed.tankName, tankLocation: seed.tankLocation, hardwareState: seed.hardwareState,
      lastReceivedTankData: { waterLevelPercentage: pct, actualWaterLevel: levelMeters, actualWaterVolume: volume, tankState: seed.hardwareState === "OFFLINE" ? "UNKNOWN" : _tankStateLabel(pct), measuredAt: new Date().toISOString() },
    };
  });
}
async function getMeters() {
  _initState();
  const hour = new Date().getHours();
  const peakFactor = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20) ? 1.35 : 1.0;
  return METER_SEEDS.map((seed) => {
    const state = _meterState[seed.flowDeviceId];
    const flowRate = seed.hardwareState === "OFFLINE" ? 0 : +_clamp(seed._baseFlow * peakFactor + _noise(8), 0, 999).toFixed(2);
    state.daily = seed.hardwareState === "OFFLINE" ? state.daily : +(state.daily + flowRate * (1 / 60)).toFixed(2);
    let flowDeviceState = "NORMAL";
    if (seed._scenario === "abnormal") flowDeviceState = Math.random() < 0.6 ? "LEAKAGE_DETECTED" : "BACKFLOW";
    if (seed.hardwareState === "OFFLINE") flowDeviceState = "OFFLINE";
    return {
      flowDeviceId: seed.flowDeviceId, flowDeviceName: seed.flowDeviceName, flowDeviceLocation: seed.flowDeviceLocation,
      consumptionThreshold: seed.consumptionThreshold, dailyConsumption: state.daily, hardwareState: seed.hardwareState,
      lastReceivedFlowData: { measuredFlowRate: flowRate, flowDeviceState, measuredAt: new Date().toISOString() },
    };
  });
}
module.exports = { getTanks, getMeters };

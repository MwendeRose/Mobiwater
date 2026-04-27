// routes/dashboard.js
const express = require("express");
const router = express.Router();

const {
  getTanks,
  getTankData,
  getTankAggregation,
  getMeters,
  getMeterData,
  getMeterConsumption
} = require("../mobiwater");

// ─────────────────────────────────────────
// 🚀 Dashboard summary
// GET /api/dashboard/summary
// ─────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const [tanks, meters] = await Promise.all([getTanks(), getMeters()]);

    const totalTanks = tanks.length;
    const highTanks = tanks.filter(t => t.lastReceivedTankData?.tankState === "HIGH").length;
    const lowTanks = tanks.filter(t => t.lastReceivedTankData?.tankState === "LOW").length;
    const normalTanks = totalTanks - highTanks - lowTanks;
    const avgLevel =
      tanks.reduce((sum, t) => sum + (t.lastReceivedTankData?.waterLevelPercentage || 0), 0) /
      (totalTanks || 1);

    const totalMeters = meters.length;
    const totalConsumption = meters.reduce((sum, m) => sum + (m.dailyConsumption || 0), 0);

    const onlineTanks = tanks.filter(t => t.hardwareState === "ONLINE").length;
    const onlineMeters = meters.filter(m => m.hardwareState === "ONLINE").length;

    const alerts = [
      ...tanks
        .filter(t => ["HIGH", "LOW"].includes(t.lastReceivedTankData?.tankState))
        .map(t => ({
          type: "TANK",
          id: t.tankId,
          name: t.tankName,
          state: t.lastReceivedTankData?.tankState,
          level: t.lastReceivedTankData?.waterLevelPercentage,
          message: `${t.tankName} is ${t.lastReceivedTankData?.tankState} (${t.lastReceivedTankData?.waterLevelPercentage}%)`
        })),
      ...meters
        .filter(m => m.lastReceivedFlowData?.flowDeviceState !== "NORMAL")
        .map(m => ({
          type: "METER",
          id: m.flowDeviceId,
          name: m.flowDeviceName,
          state: m.lastReceivedFlowData?.flowDeviceState,
          message: `${m.flowDeviceName} state: ${m.lastReceivedFlowData?.flowDeviceState}`
        }))
    ];

    res.json({
      tanks: {
        total: totalTanks,
        online: onlineTanks,
        offline: totalTanks - onlineTanks,
        high: highTanks,
        low: lowTanks,
        normal: normalTanks,
        avgLevel: Math.round(avgLevel)
      },
      flow: {
        totalMeters,
        online: onlineMeters,
        offline: totalMeters - onlineMeters,
        totalConsumption: Math.round(totalConsumption * 100) / 100
      },
      alerts
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

// ─────────────────────────────────────────
// 🪣 All tanks
// GET /api/dashboard/tanks
// ─────────────────────────────────────────
router.get("/tanks", async (req, res) => {
  try {
    const tanks = await getTanks();
    res.json(tanks);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to load tanks" });
  }
});

// ─────────────────────────────────────────
// 🪣 Single tank + historical data
// GET /api/dashboard/tanks/:tankId?fromDate=&toDate=
// ─────────────────────────────────────────
router.get("/tanks/:tankId", async (req, res) => {
  try {
    const { tankId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required (YYYY-MM-DD HH:mm:ss)" });
    }

    const data = await getTankData(tankId, fromDate, toDate);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || "Failed to load tank data" });
  }
});

// ─────────────────────────────────────────
// 📊 Tank aggregation report
// GET /api/dashboard/tanks/report?start=&end=&window=DAILY&page=0
// ─────────────────────────────────────────
router.get("/tanks-report", async (req, res) => {
  try {
    const { start, end, window = "DAILY", page = 0 } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "start and end are required (YYYY-MM-DD HH:mm:ss)" });
    }

    const data = await getTankAggregation(start, end, window, page);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to load tank aggregation report" });
  }
});

// ─────────────────────────────────────────
// 💧 All meters
// GET /api/dashboard/meters
// ─────────────────────────────────────────
router.get("/meters", async (req, res) => {
  try {
    const meters = await getMeters();
    res.json(meters);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to load meters" });
  }
});

// ─────────────────────────────────────────
// 💧 Single meter + historical data
// GET /api/dashboard/meters/:meterId?fromDate=&toDate=
// ─────────────────────────────────────────
router.get("/meters/:meterId", async (req, res) => {
  try {
    const { meterId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required (YYYY-MM-DD HH:mm:ss)" });
    }

    const data = await getMeterData(meterId, fromDate, toDate);
    res.json(data);
  } catch (err) {
    console.error(err.message);
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || "Failed to load meter data" });
  }
});

// ─────────────────────────────────────────
// 📈 Meter consumption analytics
// GET /api/dashboard/meters/:meterId/consumption?fromDate=&toDate=
// ─────────────────────────────────────────
router.get("/meters/:meterId/consumption", async (req, res) => {
  try {
    const { meterId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required (YYYY-MM-DD HH:mm:ss)" });
    }

    const total = await getMeterConsumption(meterId, fromDate, toDate);
    res.json({ flowDeviceId: meterId, fromDate, toDate, totalConsumption: total });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to load meter consumption" });
  }
});

module.exports = router;
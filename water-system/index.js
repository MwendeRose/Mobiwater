// index.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cron = require("node-cron");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Modules
const { getTanks, getMeters } = require("./mobiwater");
const { checkAndSendAlerts } = require("./alerts");
const { checkConsumptionThresholds } = require("./thresholds");
const {
  saveTankReadings,
  saveMeterReadings,
  connectDB,
} = require("./db");
const { sendDailyReport } = require("./report");
const { analyzeSystem } = require("./ai");

// Store previous states for comparisons
let previousStates = {};

// 🔁 Polling function
async function pollAndBroadcast() {
  try {
    const [tanks, meters] = await Promise.all([
      getTanks(),
      getMeters(),
    ]);

    const now = new Date();

    // 🔹 Main dashboard update
    io.emit("dashboard:update", {
      tanks,
      meters,
      updatedAt: now,
    });

    // 🔹 Granular updates
    tanks.forEach((t) => io.emit("tank:update", t));
    meters.forEach((m) => io.emit("meter:update", m));

    // 💾 Save data
    await Promise.all([
      saveTankReadings(tanks),
      saveMeterReadings(meters),
    ]);

    // 🚨 Alerts (SMS + Email + frontend)
    const alerts = await checkAndSendAlerts(
      tanks,
      meters,
      previousStates
    );

    if (alerts && alerts.length) {
      io.emit("alerts", alerts);
    }

    // 📊 Threshold checks
    await checkConsumptionThresholds(meters);

    // 🧠 AI Insights
    const insight = analyzeSystem(tanks, meters);
    io.emit("system:insight", {
      message: insight,
      time: now,
    });

    // ❤️ System health
    io.emit("system:health", {
      tanks: tanks.length,
      meters: meters.length,
      status: "running",
      time: now,
    });

    // 🔁 Update previous states
    tanks.forEach((t) => {
      previousStates[`tank_${t.tankId}`] =
        t.lastReceivedTankData?.tankState;
      previousStates[`tank_hw_${t.tankId}`] = t.hardwareState;
    });

    meters.forEach((m) => {
      previousStates[`meter_${m.flowDeviceId}`] =
        m.lastReceivedFlowData?.flowDeviceState;
      previousStates[`meter_hw_${m.flowDeviceId}`] =
        m.hardwareState;
    });

    console.log(
      `✅ Poll complete — ${tanks.length} tanks, ${meters.length} meters`
    );
  } catch (err) {
    console.error("❌ Poll error:", err.message);

    if (process.env.NODE_ENV !== "production") {
      console.error(err);
    }
  }
}

// ⏱ Run every 60 seconds
setInterval(pollAndBroadcast, 60 * 1000);

// 📄 Daily report at 7AM (Nairobi time)
cron.schedule(
  "0 7 * * *",
  async () => {
    console.log("📄 Sending daily report...");
    try {
      await sendDailyReport();
    } catch (err) {
      console.error("❌ Report error:", err.message);
    }
  },
  { timezone: "Africa/Nairobi" }
);

// 🔌 Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});


async function start() {
  try {
    await connectDB();

    await pollAndBroadcast(); // run immediately

    const PORT = process.env.PORT || 3001;

    server.listen(PORT, () => {
      console.log(
        ` Server running on port ${PORT} → http://localhost:${PORT}`
      );
    });
  } catch (err) {
    console.error("❌ Startup error:", err.message);
    process.exit(1);
  }
}

start();
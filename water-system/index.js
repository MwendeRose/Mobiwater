require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cron = require("node-cron");

// ✅ FLOW LOGGER
const { step, ok, fail } = require("./utils/logger");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", dashboardRoutes);

// API route
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

// Safe AI import
let analyzeSystem = () => "AI unavailable";
try {
  analyzeSystem = require("./models/ai").analyzeSystem;
} catch (e) {
  console.warn("⚠️ AI module not found");
}

let previousStates = {};

// =========================
// 🔁 POLLING ENGINE
// =========================
async function pollAndBroadcast() {
  const start = Date.now();

  try {
    step("CYCLE", "Starting new polling cycle");

    // 🌐 FETCH API DATA
    step("API", "Fetching tanks and meters...");
    const [tanks, meters] = await Promise.all([
      getTanks(),
      getMeters(),
    ]);

    ok("API", `Fetched ${tanks.length} tanks, ${meters.length} meters`);

    // 📡 SOCKET BROADCAST
    step("SOCKET", "Broadcasting live data...");
    io.emit("dashboard:update", {
      tanks,
      meters,
      updatedAt: new Date(),
    });
    ok("SOCKET", "Broadcast complete");

    // 💾 DATABASE SAVE
    step("DB", "Saving readings to MongoDB...");
    await Promise.all([
      saveTankReadings(tanks),
      saveMeterReadings(meters),
    ]);
    ok("DB", "Data saved successfully");

    // 🚨 ALERT ENGINE
    step("ALERTS", "Checking alert conditions...");
    const alerts = await checkAndSendAlerts(
      tanks,
      meters,
      previousStates
    );

    if (alerts && alerts.length > 0) {
      ok("ALERTS", `${alerts.length} alerts triggered`);
      io.emit("alerts", alerts);
    } else {
      ok("ALERTS", "No alerts triggered");
    }

    // 📉 CONSUMPTION CHECK
    step("THRESHOLDS", "Checking consumption limits...");
    await checkConsumptionThresholds(meters);
    ok("THRESHOLDS", "Threshold check complete");

    // 🧠 AI INSIGHT
    step("AI", "Generating system insight...");
    const insight = analyzeSystem(tanks, meters);

    io.emit("system:insight", {
      message: insight,
      time: new Date(),
    });

    ok("AI", "Insight generated");

    // ❤️ SYSTEM HEALTH
    io.emit("system:health", {
      tanks: tanks.length,
      meters: meters.length,
      status: "running",
      time: new Date(),
    });

    // 🔁 UPDATE STATE
    step("STATE", "Updating previous state memory...");
    tanks.forEach((t) => {
      previousStates[`tank_${t.tankId}`] = t.level;
    });
    ok("STATE", "State updated");

    const duration = Date.now() - start;
    ok("CYCLE", `Completed in ${duration}ms`);

  } catch (err) {
    fail("CYCLE", err.message);

    // 🔥 FULL DEBUG FOR YOUR 401 ISSUE
    console.error("\n🚨 FULL ERROR DETAILS:");
    console.error(err.response?.status || "No status");
    console.error(err.response?.data || err.message);
  }
}

// =========================
// ⏱ RUN EVERY 60 SECONDS
// =========================
setInterval(pollAndBroadcast, 60 * 1000);

// =========================
// 📄 DAILY REPORT (7AM EAT)
// =========================
cron.schedule(
  "0 7 * * *",
  async () => {
    step("REPORT", "Sending daily report...");
    try {
      await sendDailyReport();
      ok("REPORT", "Daily report sent");
    } catch (err) {
      fail("REPORT", err.message);
    }
  },
  { timezone: "Africa/Nairobi" }
);

// =========================
// 🔌 SOCKET CONNECTION
// =========================
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
});

// =========================
// 🚀 START SERVER
// =========================
async function start() {
  try {
    step("START", "Connecting to database...");
    await connectDB();
    ok("START", "MongoDB connected");

    step("START", "Running initial poll...");
    await pollAndBroadcast();

    const PORT = process.env.PORT || 3001;

    server.listen(PORT, () => {
      ok("SERVER", `Running on http://localhost:${PORT}`);
    });

  } catch (err) {
    fail("START", err.message);
    process.exit(1);
  }
}

start();
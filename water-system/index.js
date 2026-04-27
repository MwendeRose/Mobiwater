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

// Safe AI import
let analyzeSystem = () => "AI unavailable";
try {
  analyzeSystem = require("./models/ai").analyzeSystem;
} catch {
  console.warn("⚠️ ai.js not found");
}

let previousStates = {};

// 🔁 Polling
async function pollAndBroadcast() {
  try {
    const [tanks, meters] = await Promise.all([
      getTanks(),
      getMeters(),
    ]);

    const now = new Date();

    io.emit("dashboard:update", { tanks, meters, updatedAt: now });

    tanks.forEach((t) => io.emit("tank:update", t));
    meters.forEach((m) => io.emit("meter:update", m));

    await Promise.all([
      saveTankReadings(tanks),
      saveMeterReadings(meters),
    ]);

    const alerts = await checkAndSendAlerts(
      tanks,
      meters,
      previousStates
    );

    if (alerts.length) io.emit("alerts", alerts);

    await checkConsumptionThresholds(meters);

    const insight = analyzeSystem(tanks, meters);
    io.emit("system:insight", { message: insight, time: now });

    io.emit("system:health", {
      tanks: tanks.length,
      meters: meters.length,
      status: "running",
      time: now,
    });

    tanks.forEach((t) => {
      previousStates[`tank_${t.tankId}`] = t.level;
    });

    console.log(`✅ Poll complete`);

  } catch (err) {
    console.error("❌ Poll error:", err.message);
  }
}

setInterval(pollAndBroadcast, 60000);

// Daily report
cron.schedule(
  "0 7 * * *",
  async () => {
    try {
      await sendDailyReport();
    } catch (err) {
      console.error("Report error:", err.message);
    }
  },
  { timezone: "Africa/Nairobi" }
);

// Socket
io.on("connection", (socket) => {
  console.log("🟢 Client:", socket.id);
});

// Start
async function start() {
  await connectDB();
  await pollAndBroadcast();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () =>
    console.log(`Server running → http://localhost:${PORT}`)
  );
}

start();
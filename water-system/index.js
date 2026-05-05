require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cron = require("node-cron");

const { step, ok, fail } = require("./utils/logger");

const { getTanks, getMeters } = require("./mobiwater");
const { checkAndSendAlerts } = require("./alerts");
const { checkConsumptionThresholds } = require("./thresholds");
const {
  saveTankReadings,
  saveMeterReadings,
  connectDB,
} = require("./db");
const { sendDailyReport } = require("./report");

const Analyzer = require("./analyzer");

// fallback AI
let analyzeSystem = () => "AI unavailable";
try {
  analyzeSystem = require("./models/ai").analyzeSystem;
} catch (e) {}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const analyzer = new Analyzer();
const previousStates = {};

async function fetchData() {
  step("API", "Fetching tanks and meters...");
  const [tanks, meters] = await Promise.all([
    getTanks(),
    getMeters(),
  ]);
  ok("API", `Fetched ${tanks.length} tanks, ${meters.length} meters`);
  return { tanks, meters };
}

function analyzeTanks(tanks) {
  return tanks.map((tank) => {
    const data = tank.lastReceivedTankData;

    if (!data) return tank;

    const analysis = analyzer.process(data);

    return {
      ...tank,
      analysis,
    };
  });
}

async function broadcast(io, tanks, meters) {
  step("SOCKET", "Broadcasting data...");
  io.emit("dashboard:update", {
    tanks,
    meters,
    updatedAt: new Date(),
  });
  ok("SOCKET", "Broadcast complete");
}

async function persistData(tanks, meters) {
  step("DB", "Saving readings...");
  await Promise.all([
    saveTankReadings(tanks),
    saveMeterReadings(meters),
  ]);
  ok("DB", "Data saved");
}

async function runAlerts(tanks, meters) {
  step("ALERTS", "Checking alerts...");
  const alerts = await checkAndSendAlerts(
    tanks,
    meters,
    previousStates
  );

  if (alerts?.length) {
    ok("ALERTS", `${alerts.length} triggered`);
    io.emit("alerts", alerts);
  } else {
    ok("ALERTS", "None triggered");
  }
}

async function runThresholds(meters) {
  step("THRESHOLDS", "Checking consumption...");
  await checkConsumptionThresholds(meters);
  ok("THRESHOLDS", "Complete");
}

function runAI(tanks, meters) {
  step("AI", "Generating insight...");
  const insight = analyzeSystem(tanks, meters);

  io.emit("system:insight", {
    message: insight,
    time: new Date(),
  });

  ok("AI", "Insight generated");
}

function updateState(tanks) {
  step("STATE", "Updating state...");

  tanks.forEach((t) => {
    const level =
      t.lastReceivedTankData?.waterLevelPercentage || null;

    previousStates[`tank_${t.tankId}`] = level;
  });

  ok("STATE", "Updated");
}

function emitHealth(tanks, meters) {
  io.emit("system:health", {
    tanks: tanks.length,
    meters: meters.length,
    status: "running",
    time: new Date(),
  });
}

async function pollCycle() {
  const start = Date.now();

  try {
    step("CYCLE", "Starting");

    const { tanks, meters } = await fetchData();

    const analyzedTanks = analyzeTanks(tanks);

    await broadcast(io, analyzedTanks, meters);

    await persistData(analyzedTanks, meters);

    await runAlerts(analyzedTanks, meters);

    await runThresholds(meters);

    runAI(analyzedTanks, meters);

    emitHealth(analyzedTanks, meters);

    updateState(analyzedTanks);

    const duration = Date.now() - start;
    ok("CYCLE", `Completed in ${duration}ms`);
  } catch (err) {
    fail("CYCLE", err.message);

    console.error("\nFULL ERROR:");
    console.error(err.response?.status || "No status");
    console.error(err.response?.data || err.message);
  }
}

setInterval(pollCycle, 60 * 1000);

cron.schedule(
  "0 7 * * *",
  async () => {
    step("REPORT", "Sending daily report...");
    try {
      await sendDailyReport();
      ok("REPORT", "Sent");
    } catch (err) {
      fail("REPORT", err.message);
    }
  },
  { timezone: "Africa/Nairobi" }
);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

async function start() {
  try {
    step("START", "Connecting DB...");
    await connectDB();
    ok("START", "MongoDB connected");

    step("START", "Initial cycle...");
    await pollCycle();

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
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

const {
  runPredictiveChecks,
  sendRefillSchedule,
  sendBillingReport,
} = require("./predictive");

const SystemEngine = require("./systemEngine");
const engine = new SystemEngine();

const Analyzer = require("./analyzer");


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
    return { ...tank, analysis };
  });
}

async function broadcast(tanks, meters) {
  step("SOCKET", "Broadcasting...");
  io.emit("dashboard:update", {
    tanks,
    meters,
    updatedAt: new Date(),
  });
  ok("SOCKET", "Done");
}


async function persistData(tanks, meters) {
  step("DB", "Saving readings...");
  await Promise.all([
    saveTankReadings(tanks),
    saveMeterReadings(meters),
  ]);
  ok("DB", "Saved");
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

  return alerts || [];
}

async function runThresholds(meters) {
  step("THRESHOLDS", "Checking consumption...");
  await checkConsumptionThresholds(meters);
  ok("THRESHOLDS", "Done");
}


function runAI(tanks, meters) {
  step("AI", "Generating insight...");
  const insight = analyzeSystem(tanks, meters);

  io.emit("system:insight", {
    message: insight,
    time: new Date(),
  });

  ok("AI", "Done");
}

function updateState(tanks) {
  tanks.forEach((t) => {
    previousStates[`tank_${t.tankId}`] =
      t.lastReceivedTankData?.waterLevelPercentage || null;
  });
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

    tanks.forEach(t => engine.updateFreshness(t.tankId));
    meters.forEach(m => engine.updateFreshness(m.flowDeviceId));

    await broadcast(analyzedTanks, meters);
    await persistData(analyzedTanks, meters);

    const alerts = await runAlerts(analyzedTanks, meters);

    await runThresholds(meters);

    const predictive = await runPredictiveChecks(analyzedTanks, meters);

    if (predictive.refillAlerts.length ||
        predictive.trendAlerts.length ||
        predictive.leakAlerts.length) {
      io.emit("predictive:alerts", predictive);
    }

    runAI(analyzedTanks, meters);

    emitHealth(analyzedTanks, meters);

    updateState(analyzedTanks);

  
    engine.snapshot({
      tanks: analyzedTanks,
      meters,
      alerts: alerts.length,
      duration: Date.now() - start,
    });

    ok("CYCLE", `Done in ${Date.now() - start}ms`);
  } catch (err) {
    fail("CYCLE", err.message);
    console.error(err.response?.status || "No status");
    console.error(err.response?.data || err.message);
  }
}


setInterval(pollCycle, 60 * 1000);

cron.schedule(
  "0 7 * * *",
  async () => {
    step("REPORT", "Daily tasks running...");
    try {
      const { tanks } = await fetchData();
      await Promise.all([
        sendDailyReport(),
        sendRefillSchedule(analyzeTanks(tanks)),
      ]);
      ok("REPORT", "Sent");
    } catch (err) {
      fail("REPORT", err.message);
    }
  },
  { timezone: "Africa/Nairobi" }
);

cron.schedule(
  "0 8 1 * *",
  async () => {
    step("BILLING", "Running billing...");
    try {
      const meters = await getMeters();
      await sendBillingReport(meters);
      ok("BILLING", "Sent");
    } catch (err) {
      fail("BILLING", err.message);
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
const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URI);
let db;

async function connectDB() {
  if (db) return db;
  await client.connect();
  db = client.db("mobiwater");
  console.log(" Connected to MongoDB");

  await db.collection("tank_readings").createIndex({ tankId: 1, recordedAt: -1 });
  await db.collection("meter_readings").createIndex({ flowDeviceId: 1, recordedAt: -1 });

  return db;
}


async function saveTankReadings(tanks) {
  const database = await connectDB();
  const now = new Date();

  const docs = tanks.map(t => ({
    tankId: t.tankId,
    tankName: t.tankName,
    tankLocation: t.tankLocation,
    waterLevelPercentage: t.lastReceivedTankData?.waterLevelPercentage || 0,
    actualWaterLevel: t.lastReceivedTankData?.actualWaterLevel || 0,
    actualWaterVolume: t.lastReceivedTankData?.actualWaterVolume || 0,
    tankState: t.lastReceivedTankData?.tankState || "UNKNOWN",
    hardwareState: t.hardwareState,
    recordedAt: now
  }));

  if (docs.length > 0) {
    await database.collection("tank_readings").insertMany(docs);
  }
}


async function saveMeterReadings(meters) {
  const database = await connectDB();
  const now = new Date();

  const docs = meters.map(m => ({
    flowDeviceId: m.flowDeviceId,
    flowDeviceName: m.flowDeviceName,
    flowDeviceLocation: m.flowDeviceLocation,
    measuredFlowRate: m.lastReceivedFlowData?.measuredFlowRate || 0,
    dailyConsumption: m.dailyConsumption || 0,
    consumptionThreshold: m.consumptionThreshold || 0,
    flowDeviceState: m.lastReceivedFlowData?.flowDeviceState || "UNKNOWN",
    hardwareState: m.hardwareState,
    recordedAt: now
  }));

  if (docs.length > 0) {
    await database.collection("meter_readings").insertMany(docs);
  }
}

// 📊 Get tank history from DB (last N hours)
async function getTankHistory(tankId, hours = 24) {
  const database = await connectDB();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return database.collection("tank_readings")
    .find({ tankId: Number(tankId), recordedAt: { $gte: since } })
    .sort({ recordedAt: 1 })
    .toArray();
}


async function getMeterHistory(flowDeviceId, hours = 24) {
  const database = await connectDB();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return database.collection("meter_readings")
    .find({ flowDeviceId: Number(flowDeviceId), recordedAt: { $gte: since } })
    .sort({ recordedAt: 1 })
    .toArray();
}


async function getLatestTankReadings() {
  const database = await connectDB();
  return database.collection("tank_readings")
    .aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: { _id: "$tankId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } }
    ])
    .toArray();
}

async function getDailyConsumptionSummary(date = new Date()) {
  const database = await connectDB();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return database.collection("meter_readings")
    .aggregate([
      { $match: { recordedAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: "$flowDeviceId",
          flowDeviceName: { $first: "$flowDeviceName" },
          maxConsumption: { $max: "$dailyConsumption" },
          consumptionThreshold: { $first: "$consumptionThreshold" }
        }
      }
    ])
    .toArray();
}

module.exports = {
  connectDB,
  saveTankReadings,
  saveMeterReadings,
  getTankHistory,
  getMeterHistory,
  getLatestTankReadings,
  getDailyConsumptionSummary
};
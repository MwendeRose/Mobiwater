// mobiwater.js
const axios = require("axios");

const BASE_URL = process.env.BASE_URL;

let cachedToken = null;

// 🔐 Get token (with simple caching)
async function getToken() {
  if (cachedToken) return cachedToken;

  const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  });

  cachedToken = res.data.token;
  setTimeout(() => (cachedToken = null), 50 * 60 * 1000);
  return cachedToken;
}

// 🔁 Authenticated GET — clears token and retries once on 401
async function authedGet(url, params = {}) {
  const token = await getToken();
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      console.warn("🔄 Token rejected (401) — refreshing and retrying...");
      cachedToken = null;
      const freshToken = await getToken();
      const retry = await axios.get(url, {
        headers: { Authorization: `Bearer ${freshToken}` },
        params,
      });
      return retry.data;
    }
    throw err;
  }
}

// 📦 Get all tanks
async function getTanks() {
  return authedGet(`${BASE_URL}/monitoring/v1/tanks/tankaccess/`);
}

// 📦 Get tank historical data (time range)
async function getTankData(tankId, fromDate, toDate) {
  return authedGet(`${BASE_URL}/monitoring/v1/tanks/tankdata/${tankId}`, { fromDate, toDate });
}

// 📊 Get tanks aggregation report
async function getTankAggregation(start, end, window = "DAILY", page = 0) {
  return authedGet(`${BASE_URL}/monitoring/v1/tank-reports/aggregation`, { start, end, window, page });
}

// 💧 Get all flow meters
async function getMeters() {
  return authedGet(`${BASE_URL}/monitoring/v1/flowdevices/flowDeviceAccess/`);
}

// 💧 Get meter historical data (time range)
async function getMeterData(flowDeviceId, fromDate, toDate) {
  return authedGet(`${BASE_URL}/monitoring/v1/flowdevices/flowData/${flowDeviceId}`, { fromDate, toDate });
}

// 📈 Get meter consumption analytics (returns total number)
async function getMeterConsumption(flowDeviceId, fromDate, toDate) {
  return authedGet(
    `${BASE_URL}/monitoring/v1/flowdevices/flowDeviceAnalytics/consumption/${flowDeviceId}`,
    { fromDate, toDate }
  );
}

module.exports = {
  getTanks,
  getTankData,
  getTankAggregation,
  getMeters,
  getMeterData,
  getMeterConsumption,
};
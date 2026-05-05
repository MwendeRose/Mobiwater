const axios = require("axios");

const BASE_URL = process.env.BASE_URL;

let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
  const now = Date.now();

  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  console.log(" Logging into MobiWater API...");

  let res;
  try {
    res = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
    });
  } catch (err) {
    console.error(" LOGIN FAILED:");
    console.error(err.response?.data || err.message);
    throw new Error("Authentication failed — check credentials/API format");
  }

  if (!res.data?.token) {
    throw new Error("Login succeeded but no token returned");
  }

  cachedToken = res.data.token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min cache

  console.log(" Login successful");
  return cachedToken;
}

async function authedGet(url, params = {}) {
  let token = await getToken();

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return res.data;

  } catch (err) {
    if (err.response?.status === 401) {
      console.warn(" Token expired — retrying...");

      cachedToken = null;
      tokenExpiry = null;
      token = await getToken();

      const retry = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return retry.data;
    }

    console.error(" API ERROR:", err.response?.data || err.message);
    throw err;
  }
}

async function getTanks() {
  console.log(" Fetching tanks...");
  return authedGet(`${BASE_URL}/monitoring/v1/tanks/tankaccess/`);
}

async function getMeters() {
  console.log(" Fetching meters...");
  return authedGet(`${BASE_URL}/monitoring/v1/flowdevices/flowDeviceAccess/`);
}

module.exports = {
  getTanks,
  getMeters,
};
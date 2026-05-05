// systemEngine.js

class SystemEngine {
  constructor() {
    this.cache = new Map();
    this.alertState = new Map(); // alert lifecycle
    this.balances = new Map(); // prepaid balances
    this.lastSeen = new Map(); // freshness tracking
  }

  setCache(key, value) {
    this.cache.set(key, {
      value,
      time: Date.now(),
    });
  }

  getCache(key) {
    const data = this.cache.get(key);
    if (!data) return null;

    console.log(`[CACHE HIT] ${key}`);
    return data.value;
  }

  calculateLeakScore(tankDrop, meterUsage) {
    if (!tankDrop || tankDrop <= 0) return 0;

    const unaccounted = tankDrop - meterUsage;
    const score = (unaccounted / tankDrop) * 100;

    return Math.max(0, Math.min(100, score));
  }

  logLeakScore(tankName, score) {
    let level = "LOW";

    if (score > 70) level = "CRITICAL";
    else if (score > 40) level = "WARNING";

    console.log(`[LEAK SCORE] ${tankName}: ${score.toFixed(1)}% (${level})`);

    return { score, level };
  }

  setBalance(meterId, balance) {
    this.balances.set(meterId, balance);
  }

  updateBalance(meterId, cost) {
    let balance = this.balances.get(meterId) || 0;
    balance -= cost;
    this.balances.set(meterId, balance);

    this.logBalance(meterId, balance);

    return balance;
  }

  logBalance(meterId, balance) {
    let status = "OK";

    if (balance < 100) status = "CRITICAL";
    else if (balance < 300) status = "LOW";

    console.log(`[BALANCE] ${meterId}: ${balance.toFixed(2)} (${status})`);
  }

  predictRunout(meterId, costPerHour) {
    const balance = this.balances.get(meterId);
    if (!balance || costPerHour <= 0) return null;

    const hours = balance / costPerHour;

    console.log(`[BALANCE FORECAST] ${meterId} runs out in ${hours.toFixed(1)}h`);

    return hours;
  }

  createAlert(id, data) {
    this.alertState.set(id, {
      ...data,
      status: "OPEN",
      createdAt: Date.now(),
    });

    console.log(`[ALERT] OPEN: ${data.message}`);
  }

  resolveAlert(id) {
    const alert = this.alertState.get(id);
    if (!alert) return;

    alert.status = "RESOLVED";
    alert.resolvedAt = Date.now();

    console.log(`[ALERT] RESOLVED: ${id}`);
  }

  // ─────────────────────────────────────────────
  // 5. DATA FRESHNESS
  // ─────────────────────────────────────────────
  updateFreshness(key) {
    this.lastSeen.set(key, Date.now());
  }

  checkFreshness(key, thresholdMs = 60000) {
    const last = this.lastSeen.get(key);
    if (!last) return "UNKNOWN";

    const diff = Date.now() - last;

    if (diff > thresholdMs) {
      console.log(`[STALE DATA] ${key} delayed ${(diff / 1000).toFixed(0)}s`);
      return "STALE";
    }

    return "FRESH";
  }

  
  snapshot({ tanks = [], meters = [], alerts = 0, duration = 0 }) {
    console.log(`
SYSTEM SNAPSHOT 
Tanks: ${tanks.length}
Meters: ${meters.length}
Alerts: ${alerts}
Cache Size: ${this.cache.size}
Cycle Time: ${duration}ms
Status: ${alerts > 0 ? "ATTENTION" : "NORMAL"}

    `);
  }
}

module.exports = SystemEngine;
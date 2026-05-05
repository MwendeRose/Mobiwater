// analyzer.js

class Analyzer {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
  }

  process(data) {
    const reading = {
      level: data.waterLevelPercentage,
      time: new Date(data.receivedAt).getTime(),
    };

    this.history.push(reading);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return {
      abnormalUsage: this.detectAbnormal(),
      patterns: this.detectPatterns(),
      prediction: this.predict(),
    };
  }

  detectAbnormal() {
    if (this.history.length < 3) return false;

    const last = this.history[this.history.length - 1];
    const prev = this.history[this.history.length - 2];

    const diff = prev.level - last.level;

    return diff > 5; // large drop
  }

  detectPatterns() {
    const patterns = [];

    if (this.history.length < 3) return patterns;

    const last = this.history[this.history.length - 1];
    const prev = this.history[this.history.length - 2];

    const delta = last.level - prev.level;

    if (delta < -5) {
      patterns.push("Rapid drop detected");
    }

    if (delta > 5 && last.level > 90) {
      patterns.push("Rapid fill - overflow risk");
    }

    const hour = new Date(last.time).getHours();
    if (hour >= 0 && hour <= 4 && delta < -1) {
      patterns.push("Night usage detected");
    }

    return patterns;
  }

  predict() {
    if (this.history.length < 2) return null;

    const last = this.history[this.history.length - 1];
    const prev = this.history[this.history.length - 2];

    const delta = last.level - prev.level;
    const timeDiff = (last.time - prev.time) / 1000;

    if (timeDiff === 0) return null;

    const rate = delta / timeDiff;

    if (rate > 0) {
      const timeToFull = (100 - last.level) / rate;
      return {
        type: "FILLING",
        minutesToFull: Math.round(timeToFull / 60),
      };
    }

    if (rate < 0) {
      const timeToEmpty = last.level / Math.abs(rate);
      return {
        type: "DRAINING",
        minutesToEmpty: Math.round(timeToEmpty / 60),
      };
    }

    return null;
  }
}

module.exports = Analyzer;
const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
  tankId: String,
  level: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("History", historySchema);
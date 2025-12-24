const mongoose = require("mongoose");

const conditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["temperature", "humidity"],
  },
  operator: {
    type: String,
    required: true,
    enum: [">", "<"],
  },
  value: {
    type: Number,
    required: true
  }
});

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, unique: true, required: true },
    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },
    conditions: [conditionSchema],

    apiKey: { type: String, unique: true, required: true },

    // alerts
    temperatureAlert: { type: Boolean, default: false },
    humidityAlert: { type: Boolean, default: false },
    odourAlert: { type: Boolean, default: false },
    espTemprature: { type: Number, default: null },
    espHumidity: { type: Number, default: null },
    espOdour: { type: Number, default: null },
    lastUpdateTime: { type: Date, default: null }

  },
  { timestamps: true }
);

const deviceModel = mongoose.model("Device", deviceSchema);

module.exports = deviceModel;


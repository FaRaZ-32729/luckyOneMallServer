const mongoose = require("mongoose");

const conditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["temperature", "humidity", "odour", "AQI", "gass"],
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

    deviceType: {
      type: String,
      required: true,
      enum: ["OMD", "TMD", "AQIMD", "GLMD"],
    },

    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },
    conditions: [conditionSchema],

    apiKey: { type: String, unique: true, required: true },

    // COMMON alerts (all devices)
    temperatureAlert: { type: Boolean, default: false },
    humidityAlert: { type: Boolean, default: false },

    espTemprature: { type: Number, default: null },
    espHumidity: { type: Number, default: null },

    // OMD
    odourAlert: { type: Boolean },
    espOdour: { type: Number },

    // AQIMD
    aqiAlert: { type: Boolean },
    espAQI: { type: Number },

    // GLMD
    glAlert: { type: Boolean },
    espGL: { type: Number },

    lastUpdateTime: { type: Date, default: null }

  },
  { timestamps: true }
);

const deviceModel = mongoose.model("Device", deviceSchema);

module.exports = deviceModel;


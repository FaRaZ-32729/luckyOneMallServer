const mongoose = require("mongoose");

const conditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["temperature", "humidity", "odour", "AQI", "gass", "voltage"],
  },
  operator: {
    type: String,
    required: true,
    enum: [">", "<", "="],
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
      enum: ["OMD", "TMD", "AQIMD", "GLMD", "EMD", "TSD", "ESD"],
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
    odourAlert: { type: Boolean, default: false },
    espOdour: { type: Number, default: null },

    // AQIMD
    aqiAlert: { type: Boolean, default: false },
    espAQI: { type: Number, default: null },

    // GLMD
    glAlert: { type: Boolean, default: false },
    espGL: { type: Number, default: null },

    // EMD
    currentAlert: { type: Boolean, default: false },
    espCurrent: { type: Number, default: null },
    voltageAlert: { type: Boolean, default: false },
    espVoltage: { type: Number, default: null },

    lastUpdateTime: { type: Date, default: null }

  },
  { timestamps: true }
);


// ==================== FILTER FIELDS BEFORE SAVING ====================
deviceSchema.pre('save', function (next) {
  const allowedFields = {
    OMD: ["odourAlert", "espOdour"],
    AQIMD: ["aqiAlert", "espAQI"],
    GLMD: ["glAlert", "espGL"],
    EMD: ["voltageAlert", "espVoltage", "currentAlert", "espCurrent"],
    TSD: [],
    ESD: ["currentAlert", "espCurrent", "voltageAlert", "espVoltage"],
    TMD: []
  };

  const deviceType = this.deviceType;
  const specificFields = allowedFields[deviceType] || [];

  // All allowed fields
  const keepFields = [
    "deviceId", "deviceType", "venue", "conditions", "apiKey",
    "temperatureAlert", "humidityAlert", "espTemprature", "espHumidity",
    "lastUpdateTime", ...specificFields
  ];

  // Remove all other fields
  Object.keys(this.toObject()).forEach(key => {
    if (!keepFields.includes(key) && !["_id", "createdAt", "updatedAt", "__v"].includes(key)) {
      this.set(key, undefined);   // This removes the field from MongoDB
    }
  });

  next();
});

// Also clean on update (findOneAndUpdate)
deviceSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate();
  if (!update || !update.deviceType) return next();

  // Same logic can be applied here if needed
  next();
});



const deviceModel = mongoose.model("Device", deviceSchema);

module.exports = deviceModel;


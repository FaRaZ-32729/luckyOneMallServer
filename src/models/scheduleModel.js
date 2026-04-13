// src/models/scheduleModel.js
const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    status: {
        type: String,
        enum: ["ON", "OFF"],
        required: true
    },

    startJobId: String,
    endJobId: String

}, { timestamps: true });

const scheduleModel = mongoose.model("Schedule", scheduleSchema);

module.exports = scheduleModel;
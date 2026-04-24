// models/scheduleSkipModel.js
const mongoose = require("mongoose");

const scheduleSkipSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },

    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Schedule",
        required: true
    },

    date: { type: String, required: true },
    // format: "YYYY-MM-DD" (UTC)

}, { timestamps: true });
const scheduleSkipModel = mongoose.model("ScheduleSkip", scheduleSkipSchema);

module.exports = scheduleSkipModel;
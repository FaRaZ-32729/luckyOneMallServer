const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },

    startTime: { type: String, required: true },
    endTime: { type: String, required: true },

    days: [{ type: String, required: true }],

    startCron: { type: String, required: true },
    endCron: { type: String, required: true },

    startJobId: { type: String },
    endJobId: { type: String },

    status: {
        type: String,
        enum: ["ACTIVE", "INACTIVE"],
        default: "ACTIVE"
    }
}, { timestamps: true });

    const scheduleModel = mongoose.model("Schedule", scheduleSchema);

module.exports = scheduleModel;
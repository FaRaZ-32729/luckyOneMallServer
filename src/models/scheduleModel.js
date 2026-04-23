// // src/models/scheduleModel.js
// const mongoose = require("mongoose");

// const scheduleSchema = new mongoose.Schema({
//     deviceId: { type: String, required: true },

//     startTime: { type: Date, required: true },
//     endTime: { type: Date, required: true },

//     status: {
//         type: String,
//         enum: ["ON", "OFF"],
//         required: true
//     },

//     startJobId: String,
//     endJobId: String

// }, { timestamps: true });

// const scheduleModel = mongoose.model("Schedule", scheduleSchema);

// module.exports = scheduleModel;

const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },

    startTime: { type: String, required: true }, // "19:00"
    endTime: { type: String, required: true },

    days: [{ type: String, required: true }],   // ["monday", ...]

    startCron: { type: String, required: true },
    endCron: { type: String, required: true },

    startJobId: { type: String },
    endJobId: { type: String },

    status: {
        type: String,
        enum: ["ACTIVE", "PAUSED"],
        default: "ACTIVE"
    }
}, { timestamps: true });

const scheduleModel = mongoose.model("Schedule", scheduleSchema);

module.exports = scheduleModel;
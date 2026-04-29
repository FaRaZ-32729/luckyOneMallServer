const mongoose = require("mongoose");

const deviceSwitchSchema = new mongoose.Schema({

    deviceId: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ["ON", "OFF"],
        default: "OFF"
    },

    lastChangedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

const deviceSwitchModel = mongoose.model("deviceSwitch", deviceSwitchSchema);

module.exports = deviceSwitchModel;
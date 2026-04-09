const mongoose = require("mongoose");

const deviceSwitchSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
        required: true,
        unique: true // one control per device
    },

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
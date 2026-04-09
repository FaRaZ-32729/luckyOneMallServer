const deviceModel = require("../models/deviceModel");
const deviceSwitchModel = require("../models/deviceSwitchModel");

const toggleDeviceSwitch = async (req, res) => {
    try {
        const { deviceId, status } = req.body;

        if (!deviceId || !status) {
            return res.status(400).json({
                message: "deviceId and status are required"
            });
        }

        if (!["ON", "OFF"].includes(status)) {
            return res.status(400).json({
                message: "Status must be ON or OFF"
            });
        }

        // Check device exists
        const device = await deviceModel.findOne({ deviceId });
        if (!device) {
            return res.status(404).json({ message: "Device not found" });
        }

        // Optional: restrict only SD devices
        if (!["ESD", "TSD"].includes(device.deviceType)) {
            return res.status(400).json({
                message: "Only Scheduler Devices can be controlled"
            });
        }

        // Update or create control
        const control = await deviceSwitchModel.findOneAndUpdate(
            { device: device._id },
            {
                device: device._id,
                deviceId,
                status,
                lastChangedAt: new Date()
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({
            message: `Device turned ${status}`,
            control
        });

    } catch (error) {
        console.error("Error controlling device:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getSwitchedDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const control = await deviceControlModel.findOne({ deviceId });

        if (!control) {
            return res.status(404).json({
                message: "No control state found"
            });
        }

        res.status(200).json(control);

    } catch (error) {
        console.error("Error fetching control:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { toggleDeviceSwitch, getSwitchedDevice }
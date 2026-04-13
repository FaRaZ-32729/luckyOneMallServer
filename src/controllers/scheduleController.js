// src/controllers/scheduleController.js
const Schedule = require("../models/scheduleModel");
const scheduleQueue = require("../utils/scheduleQueue");

const createSchedule = async (req, res) => {
    try {
        const { deviceId, startTime, endTime } = req.body;

        if (!deviceId || !startTime || !endTime) {
            return res.status(400).json({ message: "All fields required" });
        }

        const now = new Date();

        const startDelay = new Date(startTime) - now;
        const endDelay = new Date(endTime) - now;

        if (startDelay < 0 || endDelay < 0) {
            return res.status(400).json({ message: "Time must be future" });
        }

        // 🔥 Create Jobs (ON at start, OFF at end)

        const startJob = await scheduleQueue.add(
            "device-on",
            { deviceId, action: "ON" },
            { delay: startDelay }
        );

        const endJob = await scheduleQueue.add(
            "device-off",
            { deviceId, action: "OFF" },
            { delay: endDelay }
        );

        // Save in MongoDB
        const schedule = await Schedule.create({
            deviceId,
            startTime,
            endTime,
            status: "ON",
            startJobId: startJob.id,
            endJobId: endJob.id
        });

        res.status(201).json({
            message: "Schedule created",
            schedule
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createSchedule };
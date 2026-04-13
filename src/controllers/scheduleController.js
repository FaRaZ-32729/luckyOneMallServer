// // src/controllers/scheduleController.js
// const scheduleModel = require("../models/scheduleModel");
// const scheduleQueue = require("../utils/scheduleQueue");

// const createSchedule = async (req, res) => {
//     try {
//         const { deviceId, startTime, endTime } = req.body;

//         if (!deviceId || !startTime || !endTime) {
//             return res.status(400).json({ message: "All fields required" });
//         }

//         const now = new Date();

//         const startDelay = new Date(startTime) - now;
//         const endDelay = new Date(endTime) - now;

//         if (startDelay < 0 || endDelay < 0) {
//             return res.status(400).json({ message: "Time must be future" });
//         }

//         // 🔥 Create Jobs (ON at start, OFF at end)

//         const startJob = await scheduleQueue.add(
//             "device-on",
//             { deviceId, action: "ON" },
//             { delay: startDelay }
//         );

//         const endJob = await scheduleQueue.add(
//             "device-off",
//             { deviceId, action: "OFF" },
//             { delay: endDelay }
//         );

//         // Save in MongoDB
//         const schedule = await scheduleModel.create({
//             deviceId,
//             startTime,
//             endTime,
//             status: "ON",
//             startJobId: startJob.id,
//             endJobId: endJob.id
//         });

//         res.status(201).json({
//             message: "Schedule created",
//             schedule
//         });

//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// };

// module.exports = { createSchedule };


// src/controllers/scheduleController.js
const scheduleModel = require("../models/scheduleModel");
const scheduleQueue = require("../utils/scheduleQueue");
const { sendCommandToESP } = require("../utils/schedulingSocket");

const createSchedule = async (req, res) => {
    try {
        const { deviceId, startTime, endTime, status } = req.body;

        // Validation
        if (!deviceId || !startTime || !endTime || !status) {
            return res.status(400).json({ message: "All fields are required: deviceId, startTime, endTime, status" });
        }

        if (!["ON", "OFF"].includes(status)) {
            return res.status(400).json({ message: "Status must be either 'ON' or 'OFF'" });
        }

        const now = new Date();
        const startDelay = new Date(startTime) - now;
        const endDelay = new Date(endTime) - now;

        if (startDelay < 0 || endDelay < 0) {
            return res.status(400).json({ message: "startTime and endTime must be in the future" });
        }

        let startAction = status;           // User provided start action
        let endAction;

        // Decide end action based on your requirement
        if (status === "ON") {
            endAction = "OFF";              // Normal case: ON → OFF
        } else {
            endAction = "OFF";              // As you requested: OFF → OFF
        }

        console.log(`📅 Scheduling: ${startAction} at ${startTime} | ${endAction} at ${endTime}`);

        // Create BullMQ Jobs
        const startJob = await scheduleQueue.add(
            "device-control",
            { deviceId, action: startAction },
            { delay: startDelay }
        );

        const endJob = await scheduleQueue.add(
            "device-control",
            { deviceId, action: endAction },
            { delay: endDelay }
        );

        // Save to MongoDB
        const schedule = await scheduleModel.create({
            deviceId,
            startTime,
            endTime,
            status: startAction,           // Save the user selected start status
            startJobId: startJob.id,
            endJobId: endJob.id
        });

        res.status(201).json({
            message: "Schedule created successfully",
            schedule
        });

    } catch (err) {
        console.error("Create Schedule Error:", err);
        res.status(500).json({ message: err.message });
    }
};

const eventTrigger = async (req, res) => {
    try {
        const { deviceId, action } = req.body;

        if (!deviceId || !action) {
            return res.status(400).json({ message: "Missing data" });
        }

        console.log(`Triggering ESP32: ${deviceId} -> ${action}`);

        // Call your WebSocket sender
        const success = sendCommandToESP(deviceId, action);

        if (success) {
            return res.json({ status: "sent" });
        } else {
            return res.status(500).json({ message: "No active connection" });
        }

    } catch (error) {
        console.error("Error in eventTrigger:", error.message);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = { createSchedule, eventTrigger };
// src/routes/scheduleRoutes.js
const express = require("express");
const router = express.Router();
const { createSchedule } = require("../controllers/scheduleController");
const authenticate = require("../middlewere/authMiddleware");
const { sendCommandToESP } = require("../utils/schedulingSocket");


router.post("/create", authenticate, createSchedule);


router.post("/trigger", async (req, res) => {
    const { deviceId, action } = req.body;

    if (!deviceId || !action) {
        return res.status(400).json({ message: "Missing data" });
    }

    console.log(`📡 Triggering ESP32: ${deviceId} -> ${action}`);

    // Call your WebSocket sender
    const success = sendCommandToESP(deviceId, action);

    if (success) {
        res.json({ status: "sent" });
    } else {
        res.status(500).json({ message: "No active connection" });
    }
});

module.exports = router;
// src/routes/scheduleRoutes.js
const express = require("express");
const router = express.Router();
const { createSchedule, eventTrigger } = require("../controllers/scheduleController");
const authenticate = require("../middlewere/authMiddleware");


router.post("/create", authenticate, createSchedule);

// event trigger for backend use only
router.post("/trigger", eventTrigger);

module.exports = router;
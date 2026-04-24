// src/routes/scheduleRoutes.js
const express = require("express");
const router = express.Router();
const { createSchedule, eventTrigger, skipCurrentEvent } = require("../controllers/scheduleController");
const authenticate = require("../middlewere/authMiddleware");

// create the event 
router.post("/create", authenticate, createSchedule);
// event trigger for backend use only
router.post("/trigger", eventTrigger);
// to skip current event    
router.post("/skip-event", skipCurrentEvent);

module.exports = router;
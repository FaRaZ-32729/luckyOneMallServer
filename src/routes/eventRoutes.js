const express = require("express");
const router = express.Router();
const { createSchedule, eventTrigger, skipCurrentEvent, updateScheduleStatus, getAllSchedules, getScheduleById, getSchedulesByDevice, deleteSchedule, getCurrentOrNextSchedule } = require("../controllers/eventController");
const authenticate = require("../middlewere/authMiddleware");

// create the event 
router.post("/create", authenticate, createSchedule);
// event trigger for backend use only
router.post("/trigger", eventTrigger);
// to skip current event    
router.post("/skip-event", authenticate, skipCurrentEvent);
// enab&disable events
router.patch("/update-status", authenticate, updateScheduleStatus);
// get all events
router.get("/get-all", authenticate, getAllSchedules);
router.get("/get-single/:id", authenticate, getScheduleById);
router.get("/get-by-deviceid/:deviceId", authenticate, getSchedulesByDevice);
router.delete("/delete-event/:id", authenticate, deleteSchedule);
router.get("/get-current-events/:deviceId", authenticate, getCurrentOrNextSchedule);

module.exports = router;
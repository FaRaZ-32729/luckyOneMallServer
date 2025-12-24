const express = require("express");
const { createDevice, getAllDevices, deleteDevice, updateDevice, getSingleDevice, getDevicesByVenue } = require("../controllers/deviceController");
const adminOnly = require("../middlewere/adminOnly");
const adminOrAdminCreatedUser = require("../middlewere/adminOrAdminCreatedUser");
const router = express.Router();


router.post("/add", adminOnly, createDevice);
router.put("/update/:id", adminOrAdminCreatedUser, updateDevice)
router.get("/all-devices", adminOnly, getAllDevices);
router.get("/single-device/:id", getSingleDevice);
router.get("/device-by-venue/:venueId", getDevicesByVenue);
router.delete("/delete/:id", adminOnly, deleteDevice);


module.exports = router;
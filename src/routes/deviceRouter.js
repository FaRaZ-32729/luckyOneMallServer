const express = require("express");
const { createDevice, getAllDevices, deleteDevice, updateDevice, getSingleDevice, getDevicesByVenue } = require("../controllers/deviceController");
const adminOnly = require("../middlewere/adminOnly");
const adminOrAdminCreatedUser = require("../middlewere/adminOrAdminCreatedUser");
const { toggleDeviceSwitch, getSwitchedDevice } = require("../controllers/deviceSwitchController");
const router = express.Router();


router.post("/add", adminOnly, createDevice);
router.put("/update/:id", adminOrAdminCreatedUser, updateDevice)
router.get("/all-devices", adminOnly, getAllDevices);
router.get("/single-device/:id", getSingleDevice);
router.get("/device-by-venue/:venueId", getDevicesByVenue);
router.delete("/delete/:id", adminOnly, deleteDevice);

// device switching routes 

router.post("/toggle", toggleDeviceSwitch);
router.get("/switched-device/:deviceId", getSwitchedDevice);


module.exports = router;
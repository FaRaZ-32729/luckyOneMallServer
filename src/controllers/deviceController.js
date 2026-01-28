const deviceModel = require("../models/deviceModel");
const venueModel = require("../models/venueModal");


// generates apiKey while creating and updating the device
const generateApiKey = (deviceId, conditions) => {
    let rawString = deviceId;

    conditions.forEach(cond => {
        rawString += `|${cond.type}${cond.operator}${cond.value}`;
    });

    return Buffer.from(rawString).toString("base64");
};

// object containing fields depends on deviceTypes while creating the device
const DEVICE_CONDITIONS_MAP = {
    OMD: ["odour", "temperature", "humidity"],
    TMD: ["temperature", "humidity"],
    AQIMD: ["AQI", "temperature", "humidity"],
    GLMD: ["gass", "temperature", "humidity"],
};

// alerts and value fields based on deviceTypes while creating the device
const DEVICE_EXTRA_FIELDS = {
    OMD: {
        odourAlert: false,
        espOdour: null,
    },
    AQIMD: {
        aqiAlert: false,
        espAQI: null,
    },
    GLMD: {
        glAlert: false,
        espGL: null,
    },
};


// create devices
const createDevice = async (req, res) => {
    try {
        const { deviceId, venueId, deviceType, conditions } = req.body;

        // Basic field validation
        if (!deviceId || !venueId || !deviceType || !conditions || conditions.length === 0) {
            return res.status(400).json({
                message: "deviceId, venueId, deviceType and conditions are required",
            });
        }

        // Validate deviceType
        const allowedDeviceTypes = ["OMD", "TMD", "AQIMD", "GLMD"];
        if (!allowedDeviceTypes.includes(deviceType)) {
            return res.status(400).json({
                message: `Invalid deviceType. Allowed: ${allowedDeviceTypes.join(", ")}`,
            });
        }

        // Check venue existence
        const venue = await venueModel.findById(venueId);
        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }

        // Prevent duplicate device
        const existing = await deviceModel.findOne({ deviceId });
        if (existing) {
            return res.status(400).json({ message: "Device ID already exists" });
        }

        // Validate conditions array
        if (!Array.isArray(conditions)) {
            return res.status(400).json({ message: "Conditions must be an array" });
        }

        const requiredTypes = DEVICE_CONDITIONS_MAP[deviceType];
        const providedTypes = conditions.map(c => c.type);

        // Ensure required condition types exist
        for (const type of requiredTypes) {
            if (!providedTypes.includes(type)) {
                return res.status(400).json({
                    message: `${deviceType} requires condition type "${type}"`,
                });
            }
        }

        // Existing per-condition validation (kept intact)
        const validTypes = ["temperature", "humidity", "odour", "AQI", "gass"];
        const validOps = [">", "<"];

        for (const cond of conditions) {
            if (!cond.type || !cond.operator || cond.value === undefined) {
                return res.status(400).json({
                    message: "Each condition must include type, operator, and value",
                });
            }

            if (!validTypes.includes(cond.type)) {
                return res.status(400).json({
                    message: `Invalid type "${cond.type}"`,
                });
            }

            if (!validOps.includes(cond.operator)) {
                return res.status(400).json({
                    message: `Invalid operator "${cond.operator}"`,
                });
            }
        }

        // Generate API Key (unchanged logic)
        const apiKey = generateApiKey(deviceId, conditions);

        // Save device
        const baseDeviceData = {
            deviceId,
            deviceType,
            venue: venueId,
            conditions,
            apiKey,

            // common fields always present
            temperatureAlert: false,
            humidityAlert: false,
            espTemprature: null,
            espHumidity: null,
        };

        // inject device-type specific fields
        const extraFields = DEVICE_EXTRA_FIELDS[deviceType] || {};

        const newDevice = await deviceModel.create({
            ...baseDeviceData,
            ...extraFields,
        });

        return res.status(201).json({ message: "Device created successfully", device: newDevice, });

    } catch (error) {
        console.error("Error creating device:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// get all devices
const getAllDevices = async (req, res) => {
    try {
        const devices = await deviceModel.find().populate({
            path: "venue",
            select: "name organization",
            populate: {
                path: "organization",
                select: "name"
            }
        })

        if (!devices) return res.status(404).json({ message: "No Devices" });

        res.status(200).json(devices);
    } catch (err) {
        console.error("Error fetching devices:", err);
        res.status(500).json({ message: "Failed to fetch devices" });
    }
};

// get single device by deviceId
const getSingleDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const device = await deviceModel.findById(id).populate({
            path: "venue",
            select: "name organization",
            populate: {
                path: "organization",
                select: "name"
            }
        });
        if (!device) return res.status(404).json({ message: "No Device Found" });
        res.status(200).json({ device });
    } catch (error) {
        console.log("error while fetching device", error.message);
        res.status(500).json({ message: "Failed to fetch device" });
    }
}

// get devices by venueId
const getDevicesByVenue = async (req, res) => {
    try {
        const { venueId } = req.params;

        if (!venueId) {
            return res.status(400).json({ message: "Venue ID is required" });
        }

        const devices = await deviceModel.find({ venue: venueId }).populate("venue", "name");

        if (!devices.length) {
            return res.status(404).json({ message: "No devices found for this venue" });
        }

        res.status(200).json({ devices });
    } catch (error) {
        console.error("Error fetching devices by venue:", error.message);
        res.status(500).json({ message: "Failed to fetch devices" });
    }
};

// update devices 
// NOTE :  if user updates deviceId and Conditons than new apiKey will generate otherwise apiKey remains same
const updateDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const { deviceId, venueId, conditions } = req.body;

        // Find device first
        const device = await deviceModel.findById(id);
        if (!device) {
            return res.status(404).json({ message: "Device not found" });
        }


        const oldDeviceId = device.deviceId;
        // const oldConditions = JSON.stringify(device.conditions);
        const oldConditions = device.conditions.map(c => ({
            type: c.type,
            operator: c.operator,
            value: c.value
        }));

        // Validate venue if supplied
        if (venueId) {
            const venue = await venueModel.findById(venueId);
            if (!venue) {
                return res.status(404).json({ message: "Venue not found" });
            }
        }

        // If deviceId is updated, check duplicate
        if (deviceId && deviceId !== device.deviceId) {
            const exists = await deviceModel.findOne({ deviceId });
            if (exists) {
                return res.status(400).json({
                    message: `Device ID "${deviceId}" already exists`,
                });
            }
        }

        // Validate conditions if provided
        if (conditions) {
            if (!Array.isArray(conditions)) {
                return res.status(400).json({ message: "Conditions must be an array" });
            }

            const validTypes = ["temperature", "humidity", "odour", "AQI", "gass"];
            const validOps = [">", "<"];

            for (const cond of conditions) {
                if (!cond.type || !cond.operator || cond.value === undefined) {
                    return res.status(400).json({
                        message: "Each condition must include type, operator, and value",
                    });
                }

                if (!validTypes.includes(cond.type)) {
                    return res.status(400).json({
                        message: `Invalid type "${cond.type}". Allowed: ${validTypes.join(", ")}`,
                    });
                }

                if (!validOps.includes(cond.operator)) {
                    return res.status(400).json({
                        message: `Invalid operator "${cond.operator}". Allowed: >, <`,
                    });
                }

            }
        }

        if (deviceId) device.deviceId = deviceId;
        if (venueId) device.venue = venueId;
        if (conditions) device.conditions = conditions;

        // Regenerate API key ONLY IF deviceId OR conditions changed
        let newApiKeyGenerated = false

        const newConditions = conditions
            ? conditions.map(c => ({ type: c.type, operator: c.operator, value: c.value }))
            : oldConditions;

        if ((deviceId && deviceId !== oldDeviceId) || JSON.stringify(oldConditions) !== JSON.stringify(newConditions)) {
            device.apiKey = generateApiKey(deviceId || oldDeviceId, newConditions);
            newApiKeyGenerated = true;
        }

        await device.save();

        const populatedDevice = await deviceModel
            .findById(device._id)
            .populate("venue");

        const message = newApiKeyGenerated
            ? "New API key generated! Please reconfigure your device."
            : "Device updated successfully";

        return res.status(200).json({
            message,
            device: populatedDevice,
        });

    } catch (error) {
        console.error("Error updating device:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// delete device by id
const deleteDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deviceModel.findByIdAndDelete(id);

        if (!deleted) return res.status(404).json({ message: "Device not found" });

        res.status(200).json({ message: "Device deleted successfully" });
    } catch (err) {
        console.error("Error deleting device:", err);
        res.status(500).json({ message: "Failed to delete device" });
    }
};



module.exports = { createDevice, getDevicesByVenue, getAllDevices, deleteDevice, updateDevice, getSingleDevice };
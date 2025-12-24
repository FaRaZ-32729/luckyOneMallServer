const deviceModel = require("../models/deviceModel");
const venueModel = require("../models/venueModal");



const generateApiKey = (deviceId, conditions) => {
    let rawString = deviceId;

    conditions.forEach(cond => {
        rawString += `|${cond.type}${cond.operator}${cond.value}`;
    });

    return Buffer.from(rawString).toString("base64");
};

// create devices
const createDevice = async (req, res) => {
    try {
        const { deviceId, venueId, conditions } = req.body;

        // Basic field validation
        if (!deviceId || !venueId || conditions.length === 0) {
            return res.status(400).json({ message: "deviceId , venueId and conditions are required" });
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
        if (conditions) {
            if (!Array.isArray(conditions)) {
                return res.status(400).json({ message: "Conditions must be an array" });
            }

            for (const cond of conditions) {
                // Required keys
                if (!cond.type || !cond.operator || cond.value === undefined) {
                    return res.status(400).json({
                        message: "Each condition must include type, operator, and value",
                    });
                }

                // Allowed type values
                const validTypes = ["temperature", "humidity"];
                if (!validTypes.includes(cond.type)) {
                    return res.status(400).json({
                        message: `Invalid type "${cond.type}". Allowed types: ${validTypes.join(", ")}`,
                    });
                }

                // Allowed operators
                const validOps = [">", "<"];
                if (!validOps.includes(cond.operator)) {
                    return res.status(400).json({
                        message: `Invalid operator "${cond.operator}". Allowed operators: >, <`,
                    });
                }

            }
        }

        // Generate API Key
        const apiKey = generateApiKey(deviceId, conditions || []);

        // Save device
        const newDevice = await deviceModel.create({
            deviceId,
            venue: venueId,
            conditions: conditions,
            apiKey,
        });

        return res.status(201).json({
            message: "Device created successfully",
            device: newDevice,
        });
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
        // .populate({
        //     path: "venue",
        //     select: "name organization",
        //     populate: {
        //         path: "organization",
        //         select: "name"
        //     }
        // .populate("venue", "name");

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

            const validTypes = ["temperature", "humidity"];
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
const scheduleModel = require("../models/scheduleModel");
const scheduleSkipModel = require("../models/scheduleSkipModel");
const scheduleQueue = require("../utils/scheduleQueue");
const { generateCron } = require("../utils/cronHelper");
const { sendCommandToESP } = require("../utils/schedulingSocket");

// const createSchedule = async (req, res) => {
//     try {
//         const { deviceId, startTime, endTime } = req.body;

//         // Validation
//         if (!deviceId || !startTime || !endTime) {
//             return res.status(400).json({ 
//                 message: "All fields are required: deviceId, startTime, endTime" 
//             });
//         }

//         const now = new Date();
//         const startDate = new Date(startTime);
//         const endDate = new Date(endTime);

//         const startDelay = startDate - now;
//         const endDelay = endDate - now;

//         if (startDelay < 0 || endDelay < 0) {
//             return res.status(400).json({ 
//                 message: "startTime and endTime must be in the future" 
//             });
//         }

//         if (startDelay >= endDelay) {
//             return res.status(400).json({ 
//                 message: "endTime must be after startTime" 
//             });
//         }

//         console.log(`📅 Creating Schedule → ON at ${startTime} | OFF at ${endTime}`);

//         // ==================== Create BullMQ Jobs ====================
//         const startJob = await scheduleQueue.add(
//             "device-control",
//             { deviceId, action: "ON" },
//             { delay: startDelay }
//         );

//         const endJob = await scheduleQueue.add(
//             "device-control",
//             { deviceId, action: "OFF" },
//             { delay: endDelay }
//         );

//         // ==================== Save to MongoDB ====================
//         const schedule = await scheduleModel.create({
//             deviceId,
//             startTime: startDate,
//             endTime: endDate,
//             status: "ON",                    // Always ON as start action
//             startJobId: startJob.id,
//             endJobId: endJob.id
//         });

//         res.status(201).json({
//             message: "Schedule created successfully (ON → OFF)",
//             schedule
//         });

//     } catch (err) {
//         console.error("Create Schedule Error:", err);
//         res.status(500).json({ 
//             message: "Internal Server Error",
//             error: err.message 
//         });
//     }
// };

// check the schedule on friday 9 5 on espdevice b ends on 9 10 
// check the schedule on monday 9 10 on espdevice b ends on 9 10
const createSchedule = async (req, res) => {
    try {
        const { deviceId, startTime, endTime, days } = req.body;

        if (!deviceId || !startTime || !endTime || !days?.length) {
            return res.status(400).json({
                message: "deviceId, startTime, endTime, days required"
            });
        }

        const startCron = generateCron(startTime, days);
        const endCron = generateCron(endTime, days);

        const existing = await scheduleModel.findOne({
            deviceId,
            startCron,
            endCron
        });

        if (existing) {
            return res.status(400).json({
                message: "Schedule already exists"
            });
        }

        console.log("Start Cron:", startCron);
        console.log("End Cron:", endCron);


        // 🔥 Create unique IDs (IMPORTANT)
        const startJobId = `${deviceId}-ON-${startCron}`;
        const endJobId = `${deviceId}-OFF-${endCron}`;

        // 🔥 Add ON job
        await scheduleQueue.add(
            "schedule-queue",
            { deviceId, action: "ON" },
            {
                jobId: startJobId,
                repeat: {
                    pattern: startCron,
                    tz: "UTC"
                }
            }
        );

        // 🔥 Add OFF job
        await scheduleQueue.add(
            "schedule-queue",
            { deviceId, action: "OFF" },
            {
                jobId: endJobId,
                repeat: {
                    pattern: endCron,
                    tz: "UTC"
                }
            }
        );

        // ==================== SAVE IN MONGODB ====================
        const schedule = await scheduleModel.create({
            deviceId,
            startTime,       // store as string "19:00"
            endTime,         // store as string
            days,            // ["monday", "wednesday"]
            startCron,
            endCron,
            status: "ACTIVE",
            startJobId,
            endJobId
        });

        res.status(201).json({
            message: "✅ Recurring schedule created",
            schedule
        });

    } catch (err) {
        console.error(err);
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
        console.log("TRIGGER HIT:", req.body);

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

// skip event api
const skipCurrentEvent = async (req, res) => {
    try {
        const { deviceId } = req.body;

        if (!deviceId) {
            return res.status(400).json({ message: "deviceId required" });
        }

        const now = new Date();
        const todayDate = now.toISOString().split("T")[0];

        const currentDay = now.getUTCDay();

        const dayMapReverse = {
            0: "sunday",
            1: "monday",
            2: "tuesday",
            3: "wednesday",
            4: "thursday",
            5: "friday",
            6: "saturday"
        };

        const today = dayMapReverse[currentDay];

        const hours = String(now.getUTCHours()).padStart(2, "0");
        const minutes = String(now.getUTCMinutes()).padStart(2, "0");
        const currentTime = `${hours}:${minutes}`;

        const schedules = await scheduleModel.find({
            deviceId,
            days: today,
            status: "ACTIVE"
        });

        let activeSchedule = null;

        for (const schedule of schedules) {
            const { startTime, endTime } = schedule;

            if (startTime < endTime) {
                if (currentTime >= startTime && currentTime < endTime) {
                    activeSchedule = schedule;
                    break;
                }
            } else {
                if (currentTime >= startTime || currentTime < endTime) {
                    activeSchedule = schedule;
                    break;
                }
            }
        }

        if (!activeSchedule) {
            return res.status(400).json({
                message: "No active event to skip"
            });
        }

        // 🔥 Save skip
        await scheduleSkipModel.create({
            deviceId,
            scheduleId: activeSchedule._id,
            date: todayDate
        });

        // 🔥 IMMEDIATE EFFECT
        await sendCommandToESP(deviceId, "OFF");

        console.log("⛔ Event skipped + device turned OFF");

        res.json({
            message: "⛔ Event skipped and device turned OFF"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// disable and enable schedule
const updateScheduleStatus = async (req, res) => {
    const { scheduleId, status } = req.body;

    if (!scheduleId || !["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ message: "Invalid data" });
    }

    await scheduleModel.updateOne(
        { _id: scheduleId },
        { status }
    );

    res.json({ message: `Schedule ${status === "ACTIVE" ? "enabled" : "disabled"}` });
};

const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await scheduleModel.findById(id);
        if (!schedule) {
            return res.status(404).json({ message: "Schedule not found" });
        }

        await scheduleQueue.removeRepeatable("schedule-queue", {
            pattern: schedule.startCron,
            tz: "UTC"
        });

        await scheduleQueue.removeRepeatable("schedule-queue", {
            pattern: schedule.endCron,
            tz: "UTC"
        });

        await schedule.deleteOne();

        res.json({ message: "🗑️ Schedule deleted" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createSchedule, eventTrigger, skipCurrentEvent, updateScheduleStatus };
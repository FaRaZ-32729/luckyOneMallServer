const scheduleModel = require("../models/eventModel");
const scheduleSkipModel = require("../models/scheduleSkipModel");
const scheduleQueue = require("../utils/scheduleQueue");
const { generateCron } = require("../utils/cronHelper");
const { sendCommandToESP } = require("../utils/schedulingSocket");
const deviceModel = require("../models/deviceModel");
const deviceSwitchModel = require("../models/deviceSwitchModel");
const { isOvernight, getScheduleDaysForCheck } = require("../utils/scheduleHelpers");

const createSchedule = async (req, res) => {
    try {
        const { deviceId, startTime, endTime, days } = req.body;

        if (!deviceId || !startTime || !endTime || !days?.length) {
            return res.status(400).json({
                message: "deviceId, startTime, endTime, days required"
            });
        }

        const startCron = generateCron(startTime, days);

        let endDays = [...days];

        // 🔥 Handle overnight schedules
        if (isOvernight(startTime, endTime)) {
            const dayOrder = [
                "sunday", "monday", "tuesday", "wednesday",
                "thursday", "friday", "saturday"
            ];

            endDays = days.map(d => {
                const idx = dayOrder.indexOf(d.toLowerCase().trim());
                return dayOrder[(idx + 1) % 7];
            });
        }

        const endCron = generateCron(endTime, endDays);

        // const startCron = generateCron(startTime, days);
        // const endCron = generateCron(endTime, days);

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

// for backend use only
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

// toggle button api 
const toggleDeviceSwitch = async (req, res) => {
    try {
        const { deviceId, status } = req.body;

        if (!deviceId || !status) {
            return res.status(400).json({
                message: "deviceId and status are required"
            });
        }

        if (!["ON", "OFF"].includes(status)) {
            return res.status(400).json({
                message: "Status must be ON or OFF"
            });
        }

        // Check device exists
        const device = await deviceModel.findOne({ deviceId });
        if (!device) {
            return res.status(404).json({ message: "Device not found" });
        }

        // Optional: restrict only SD devices
        if (!["ESD", "TSD"].includes(device.deviceType)) {
            return res.status(400).json({
                message: "Only Scheduler Devices can be controlled"
            });
        }

        // === SEND COMMAND TO ESP32 ===
        const commandSent = await sendCommandToESP(deviceId, status);

        return res.status(200).json({
            note: commandSent
                ? "Command sent to device successfully"
                : "Device is offline"
        });


    } catch (error) {
        console.error("Error controlling device:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// get off/on status of the device 
const getDeviceStatus = async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({
                message: "deviceId is required"
            });
        }

        const deviceStatus = await deviceSwitchModel.findOne({ deviceId });


        if (!deviceStatus) {
            return res.status(404).json({
                message: "No status found for this device"
            });
        }

        return res.status(200).json({
            deviceId: deviceStatus.deviceId,
            status: deviceStatus.status,
            lastChangedAt: deviceStatus.lastChangedAt
        });

    } catch (error) {
        console.error("Error fetching device status:", error);
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

// skip event api
const skipCurrentEvent = async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ message: "deviceId required" });

        const now = new Date();
        const todayDate = now.toISOString().split("T")[0];
        const currentDay = now.getUTCDay();

        const dayMapReverse = {
            0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
            4: "thursday", 5: "friday", 6: "saturday"
        };

        const today = dayMapReverse[currentDay];
        const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

        const schedules = await scheduleModel.find({ deviceId, status: "ACTIVE" });

        let activeSchedule = null;

        for (const schedule of schedules) {
            const relevantDays = getScheduleDaysForCheck(schedule);
            if (!relevantDays.includes(today)) continue;

            const isOvernightSchedule = isOvernight(schedule.startTime, schedule.endTime);
            let isActiveNow = false;

            if (!isOvernightSchedule) {
                if (currentTime >= schedule.startTime && currentTime < schedule.endTime) {
                    isActiveNow = true;
                }
            } else {
                if (currentTime >= schedule.startTime || currentTime < schedule.endTime) {
                    isActiveNow = true;
                }
            }

            if (isActiveNow) {
                activeSchedule = schedule;
                break;
            }
        }

        if (!activeSchedule) {
            return res.status(400).json({ message: "No active event to skip" });
        }

        await scheduleSkipModel.deleteMany({ deviceId });
        await scheduleSkipModel.create({
            deviceId,
            scheduleId: activeSchedule._id,
            date: todayDate
        });

        await sendCommandToESP(deviceId, "OFF");

        console.log("⛔ Event skipped + device turned OFF");
        res.json({ message: "⛔ Event skipped and device turned OFF" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
// const skipCurrentEvent = async (req, res) => {
//     try {
//         const { deviceId } = req.body;

//         if (!deviceId) {
//             return res.status(400).json({ message: "deviceId required" });
//         }

//         const now = new Date();
//         const todayDate = now.toISOString().split("T")[0];

//         const currentDay = now.getUTCDay();

//         const dayMapReverse = {
//             0: "sunday",
//             1: "monday",
//             2: "tuesday",
//             3: "wednesday",
//             4: "thursday",
//             5: "friday",
//             6: "saturday"
//         };

//         const today = dayMapReverse[currentDay];

//         const hours = String(now.getUTCHours()).padStart(2, "0");
//         const minutes = String(now.getUTCMinutes()).padStart(2, "0");
//         const currentTime = `${hours}:${minutes}`;

//         const schedules = await scheduleModel.find({
//             deviceId,
//             days: today,
//             status: "ACTIVE"
//         });

//         let activeSchedule = null;

//         for (const schedule of schedules) {
//             const { startTime, endTime } = schedule;

//             if (startTime < endTime) {
//                 if (currentTime >= startTime && currentTime < endTime) {
//                     activeSchedule = schedule;
//                     break;
//                 }
//             } else {
//                 if (currentTime >= startTime || currentTime < endTime) {
//                     activeSchedule = schedule;
//                     break;
//                 }
//             }
//         }

//         if (!activeSchedule) {
//             return res.status(400).json({
//                 message: "No active event to skip"
//             });
//         }

//         await scheduleSkipModel.deleteMany({ deviceId });

//         // 🔥 Save skip
//         await scheduleSkipModel.create({
//             deviceId,
//             scheduleId: activeSchedule._id,
//             date: todayDate
//         });

//         // 🔥 IMMEDIATE EFFECT
//         await sendCommandToESP(deviceId, "OFF");

//         console.log("⛔ Event skipped + device turned OFF");

//         res.json({
//             message: "⛔ Event skipped and device turned OFF"
//         });

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: err.message });
//     }
// };

// disable and enable schedule
const updateScheduleStatus = async (req, res) => {
    try {
        const { scheduleId, status } = req.body;

        if (!scheduleId || !["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({ message: "Invalid data" });
        }

        const updated = await scheduleModel.findByIdAndUpdate(
            scheduleId,
            { status },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        return res.json({
            message: `Schedule ${status === "ACTIVE" ? "enabled" : "disabled"}`,
            schedule: updated
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};

const getAllSchedules = async (req, res) => {
    try {
        const schedules = await scheduleModel.find().sort({ createdAt: -1 });

        if (!schedules) {
            return res.status(401).json({ message: "No Events To Show" })
        }

        return res.status(200).json({
            count: schedules.length,
            schedules
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const getScheduleById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(404).json({
                message: "Id required"
            });
        }

        const schedule = await scheduleModel.findById(id);

        if (!schedule) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        return res.status(200).json(schedule);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const getSchedulesByDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;

        if (!deviceId) {
            return res.status(400).json({
                message: "deviceId required"
            });
        }

        const schedules = await scheduleModel.find({ deviceId });

        return res.status(200).json({
            count: schedules.length,
            schedules
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await scheduleModel.findById(id);

        if (!schedule) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        // 🔥 Remove repeat jobs from BullMQ
        await scheduleQueue.removeRepeatable("schedule-queue", {
            jobId: schedule.startJobId,
            pattern: schedule.startCron,
            tz: "UTC"
        });

        await scheduleQueue.removeRepeatable("schedule-queue", {
            jobId: schedule.endJobId,
            pattern: schedule.endCron,
            tz: "UTC"
        });

        // 🔥 Delete from DB
        await schedule.deleteOne();

        res.status(200).json({
            message: "Schedule deleted successfully"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// const getCurrentOrNextSchedule = async (req, res) => {
//     try {
//         const { deviceId } = req.params;

//         if (!deviceId) {
//             return res.status(400).json({
//                 message: "deviceId required"
//             });
//         }

//         const now = new Date();

//         const currentDay = now.getUTCDay();

//         const dayMapReverse = {
//             0: "sunday",
//             1: "monday",
//             2: "tuesday",
//             3: "wednesday",
//             4: "thursday",
//             5: "friday",
//             6: "saturday"
//         };

//         const today = dayMapReverse[currentDay];

//         const hours = String(now.getUTCHours()).padStart(2, "0");
//         const minutes = String(now.getUTCMinutes()).padStart(2, "0");
//         const currentTime = `${hours}:${minutes}`;

//         const schedules = await scheduleModel.find({
//             deviceId,
//             status: "ACTIVE"
//         });

//         let active = null;
//         let upcoming = null;

//         for (const schedule of schedules) {

//             const daysMatch = schedule.days.includes(today);

//             if (daysMatch) {
//                 const { startTime, endTime } = schedule;

//                 // 🔥 ACTIVE CHECK
//                 if (startTime < endTime) {
//                     if (currentTime >= startTime && currentTime < endTime) {
//                         active = schedule;
//                     }
//                 } else {
//                     if (currentTime >= startTime || currentTime < endTime) {
//                         active = schedule;
//                     }
//                 }
//             }

//             // 🔥 FIND NEXT UPCOMING EVENT
//             const todayMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
//             const [sHour, sMin] = schedule.startTime.split(":");
//             const startMinutes = parseInt(sHour) * 60 + parseInt(sMin);

//             if (startMinutes > todayMinutes) {
//                 if (!upcoming || startMinutes < upcoming.startMinutes) {
//                     upcoming = {
//                         ...schedule._doc,
//                         startMinutes
//                     };
//                 }
//             }
//         }

//         if (active) {
//             return res.status(200).json({
//                 type: "CURRENT",
//                 event: active
//             });
//         }

//         if (upcoming) {
//             return res.status(200).json({
//                 type: "NEXT",
//                 event: upcoming
//             });
//         }

//         return res.status(200).json({
//             message: "No event to show"
//         });

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ message: err.message });
//     }
// };

// getCurrentOrNextSchedule
const getCurrentOrNextSchedule = async (req, res) => {
    try {
        const { deviceId } = req.params;
        if (!deviceId) return res.status(400).json({ message: "deviceId required" });

        const now = new Date();

        const currentDayIndex = now.getUTCDay();
        const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
        const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

        const dayMapReverse = {
            0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
            4: "thursday", 5: "friday", 6: "saturday"
        };

        const todayName = dayMapReverse[currentDayIndex];
        const todayDate = now.toISOString().split("T")[0];

        console.log(`🔍 UTC Now: ${currentTime} | Today: ${todayName}`);

        const schedules = await scheduleModel.find({ deviceId, status: "ACTIVE" });
        const skippedRecord = await scheduleSkipModel.findOne({ deviceId, date: todayDate });

        let active = null;
        let nextEvent = null;
        let minMinutesToNext = Infinity;

        for (const schedule of schedules) {
            const relevantDays = getScheduleDaysForCheck(schedule);
            const isOvernightSchedule = isOvernight(schedule.startTime, schedule.endTime);
            const isThisScheduleSkipped = skippedRecord &&
                skippedRecord.scheduleId.toString() === schedule._id.toString();

            // ====================== CURRENT EVENT CHECK ======================
            let isCurrentlyActive = false;

            if (relevantDays.includes(todayName)) {
                if (!isOvernightSchedule) {
                    if (currentTime >= schedule.startTime && currentTime < schedule.endTime) {
                        isCurrentlyActive = true;
                    }
                } else {
                    if (currentTime >= schedule.startTime || currentTime < schedule.endTime) {
                        isCurrentlyActive = true;
                    }
                }
            }

            if (isCurrentlyActive && !isThisScheduleSkipped) {
                active = schedule;
                console.log(`✅ Active Event Found: ${schedule.startTime} - ${schedule.endTime}`);
                break;
            }

            // ====================== NEXT EVENT LOGIC (Always Check) ======================
            const [sHour, sMin] = schedule.startTime.split(":");
            const startMinutes = parseInt(sHour) * 60 + parseInt(sMin);

            for (let i = 0; i < 7; i++) {
                const dayOffset = i;
                const checkDayIndex = (currentDayIndex + dayOffset) % 7;
                const checkDayName = dayMapReverse[checkDayIndex];

                if (!relevantDays.includes(checkDayName)) continue;

                let minutesUntil = 0;

                if (dayOffset === 0) {
                    // Today
                    if (startMinutes > currentMinutes) {
                        minutesUntil = startMinutes - currentMinutes;
                    } else {
                        continue;
                    }
                } else {
                    // Future days (including next week)
                    minutesUntil = (dayOffset * 24 * 60) + startMinutes - currentMinutes;
                }

                if (minutesUntil < minMinutesToNext) {
                    minMinutesToNext = minutesUntil;

                    nextEvent = {
                        ...schedule._doc,
                        nextDay: checkDayName,
                        nextStartTime: schedule.startTime,
                        minutesUntil
                    };
                }
                break; // Take first valid day for this schedule
            }
        }

        // ====================== RESPONSE ======================
        if (active) {
            return res.status(200).json({ type: "CURRENT", event: active });
        }

        if (nextEvent) {
            // Clean response (remove internal fields)
            delete nextEvent.minutesUntil;
            return res.status(200).json({ type: "NEXT", event: nextEvent });
        }

        return res.status(200).json({
            type: "NO_EVENT",
            message: "No active or upcoming schedule found"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
};

// const getCurrentOrNextSchedule = async (req, res) => {
//     try {
//         const { deviceId } = req.params;

//         if (!deviceId) {
//             return res.status(400).json({ message: "deviceId required" });
//         }

//         const now = new Date();
//         const todayDate = now.toISOString().split("T")[0];        // e.g., "2026-04-30"
//         const currentDay = now.getUTCDay();

//         const dayMapReverse = {
//             0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
//             4: "thursday", 5: "friday", 6: "saturday"
//         };

//         const today = dayMapReverse[currentDay];
//         const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

//         // Get all active schedules for this device
//         const schedules = await scheduleModel.find({
//             deviceId,
//             status: "ACTIVE"
//         });

//         // Check if any event was skipped TODAY
//         const skippedRecord = await scheduleSkipModel.findOne({
//             deviceId,
//             date: todayDate
//         });

//         let active = null;
//         let upcoming = null;

//         for (const schedule of schedules) {
//             const daysMatch = schedule.days.includes(today);
//             if (!daysMatch) continue;

//             const { startTime, endTime } = schedule;

//             // Check if this specific schedule was skipped today
//             const isThisScheduleSkipped = skippedRecord &&
//                 skippedRecord.scheduleId.toString() === schedule._id.toString();

//             // === CURRENT EVENT CHECK ===
//             let isCurrentlyActive = false;

//             if (startTime < endTime) {
//                 if (currentTime >= startTime && currentTime < endTime) {
//                     isCurrentlyActive = true;
//                 }
//             } else {
//                 if (currentTime >= startTime || currentTime < endTime) {
//                     isCurrentlyActive = true;
//                 }
//             }

//             if (isCurrentlyActive) {
//                 if (isThisScheduleSkipped) {
//                     console.log(`[Skipped] Event for ${deviceId} was skipped today`);
//                     continue;                    // Skip this event - user already skipped it
//                 }
//                 active = schedule;
//                 break;
//             }

//             // === UPCOMING EVENT ===
//             const todayMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
//             const [sHour, sMin] = schedule.startTime.split(":");
//             const startMinutes = parseInt(sHour) * 60 + parseInt(sMin);

//             if (startMinutes > todayMinutes) {
//                 if (!upcoming || startMinutes < upcoming.startMinutes) {
//                     upcoming = { ...schedule._doc, startMinutes };
//                 }
//             }
//         }

//         if (active) {
//             return res.status(200).json({
//                 type: "CURRENT",
//                 event: active
//             });
//         }

//         if (upcoming) {
//             return res.status(200).json({
//                 type: "NEXT",
//                 event: upcoming
//             });
//         }

//         return res.status(200).json({
//             type: "NO_EVENT",
//             message: "No active or upcoming event"
//         });

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ message: err.message });
//     }
// };

module.exports = { createSchedule, eventTrigger, skipCurrentEvent, updateScheduleStatus, getAllSchedules, getScheduleById, getSchedulesByDevice, toggleDeviceSwitch, deleteSchedule, getCurrentOrNextSchedule, getDeviceStatus };
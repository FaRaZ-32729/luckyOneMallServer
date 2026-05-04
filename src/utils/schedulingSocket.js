const WebSocket = require("ws");
const deviceModel = require("../models/deviceModel");
const scheduleModel = require("../models/eventModel");
const deviceSwitchModel = require("../models/deviceSwitchModel");
const scheduleSkipModel = require("../models/scheduleSkipModel");
const { getScheduleDaysForCheck, isOvernight } = require("./scheduleHelpers");

let schedulingWss;

const schedulingSocket = (server) => {
    schedulingWss = new WebSocket.Server({ noServer: true });
    console.log("Scheduling Devices WebSocket Initialized");

    schedulingWss.on("connection", (ws, req) => {
        const serverIp = req.socket.remoteAddress;
        console.log(`Scheduling Device connected from ${serverIp}`);

        ws.deviceId = null;

        ws.on("message", async (message) => {
            console.log("Received from ESP32:", message.toString());

            let data;
            try {
                data = JSON.parse(message);
            } catch (err) {
                console.log("Non-JSON message received");
                return;
            }

            if (!data.deviceId) {
                console.log("No deviceId in payload");
                return;
            }

            // ==================== HANDSHAKE / AUTH ====================
            if (data.action === "HANDSHAKE" && data.deviceId && data.deviceType) {
                ws.deviceId = data.deviceId;
                console.log(` Device Authenticated: ${data.deviceId} (${data.deviceType})`);

                ws.send(JSON.stringify({
                    type: "AUTH_SUCCESS",
                    message: "Device registered successfully"
                }));

                await reconcileMissedCommands(ws.deviceId, ws);

                return;
            }

            // Set deviceId for all valid messages
            ws.deviceId = data.deviceId;

            // ==================== IGNORE ACK / CONTROL RESPONSES ====================
            // if (data.ack) {
            //     console.log("⏭ ACK received, skipping DB update");
            //     return;
            // }
            // ================== ACK HANDLING (IMPORTANT FIX) ==================
            if (data.ack) {
                console.log("ACK received from ESP:", data);

                try {
                    await deviceSwitchModel.findOneAndUpdate(
                        { deviceId: data.deviceId },
                        {
                            deviceId: data.deviceId,
                            status: data.status,
                            lastChangedAt: new Date()
                        },
                        {
                            new: true,
                            upsert: true
                        }
                    );

                    console.log("DB updated from ACK");
                } catch (err) {
                    console.error("ACK DB update error:", err.message);
                }

                return;
            }

            // ==================== ONLY PROCESS SENSOR DATA ====================
            if (data.temperature || data.humidity || data.current || data.voltage) {

                try {
                    const updatePayload = {
                        // lastUpdateTime: moment().tz("Asia/Karachi").format()
                        lastUpdateTime: new Date()
                    };

                    if (data.temperature !== undefined) {
                        updatePayload.espTemprature = data.temperature;
                        updatePayload.temperatureAlert = data.temperatureAlert === "HIGH";
                    }

                    if (data.humidity !== undefined) {
                        updatePayload.espHumidity = data.humidity;
                        updatePayload.humidityAlert = data.humidityAlert === "HIGH";
                    }

                    if (data.current !== undefined) {
                        updatePayload.espCurrent = data.current;
                        updatePayload.currentAlert = data.currentAlert === "HIGH";
                    }

                    if (data.voltage !== undefined) {
                        updatePayload.espVoltage = data.voltage;
                        updatePayload.voltageAlert = data.voltageAlert === "HIGH";
                    }

                    const updated = await deviceModel.findOneAndUpdate(
                        { deviceId: data.deviceId },
                        updatePayload,
                        { new: true }
                    );

                    console.log(`MongoDB Updated Successfully for: ${data.deviceId}`);

                    if (updated) {
                        console.log(
                            `   Temperature: ${updated.espTemprature}, Humidity: ${updated.espHumidity}`
                        );
                    }

                } catch (error) {
                    console.error("DB Update Error:", error.message);
                }

                return;
            }

            // ==================== status ====================
            console.log("status:", data);
        });

        ws.on("close", () => {
            console.log(`Device disconnected: ${ws.deviceId || 'Unknown'}`);
        });

        ws.on("error", (err) => {
            console.error("WebSocket Error:", err.message);
        });

        // Welcome Message
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ serverMsg: "Connected to Scheduling Server" }));
            }
        }, 1000);
    });

    return schedulingWss;
};

// ==================== SEND COMMAND ====================
const sendCommandToESP = async (deviceId, status) => {
    if (!schedulingWss) return false;

    let payload = {
        type: "COMMAND",
        command: status,
        deviceId: deviceId,
        timestamp: new Date().toISOString()
    };

    // ==================== ONLY FOR "ON" → attach schedule times ====================
    // if (status === "ON") {
    //     try {
    //         // const now = moment().tz("Asia/Karachi").toDate();
    //         const now = new Date();

    //         const activeSchedule = await scheduleModel.findOne({
    //             deviceId,
    //             startTime: { $lte: now },
    //             endTime: { $gt: now }
    //         }).sort({ startTime: -1 });

    //         if (activeSchedule) {
    //             payload.startTimeUnix = Math.floor(activeSchedule.startTime.getTime() / 1000);
    //             payload.endTimeUnix = Math.floor(activeSchedule.endTime.getTime() / 1000);

    //             console.log(`ON command enriched with times → endTimeUnix: ${payload.endTimeUnix}`);
    //         }
    //     } catch (err) {
    //         console.error("Failed to fetch schedule times for ON command:", err.message);
    //     }
    // }
    if (status === "ON") {
        try {
            const now = new Date();

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

            // Current UTC time HH:mm
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
                    // 🔥 midnight crossover
                    if (currentTime >= startTime || currentTime < endTime) {
                        activeSchedule = schedule;
                        break;
                    }
                }
            }

            if (activeSchedule) {
                // 🔥 Build TODAY's UTC date with endTime
                const [endHour, endMinute] = activeSchedule.endTime.split(":");

                let endDate = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate(),
                    parseInt(endHour),
                    parseInt(endMinute),
                    0
                ));

                // 🔥 If crossed midnight → move to next day
                if (activeSchedule.startTime > activeSchedule.endTime) {
                    if (currentTime >= activeSchedule.startTime) {
                        endDate.setUTCDate(endDate.getUTCDate() + 1);
                    }
                }

                payload.endTimeUnix = Math.floor(endDate.getTime() / 1000);

                console.log(`✅ ON enriched → endTimeUnix: ${payload.endTimeUnix}`);
            }

        } catch (err) {
            console.error("Failed to attach schedule time:", err.message);
        }
    }

    let sent = false;
    schedulingWss.clients.forEach((client) => {
        if (client.deviceId === deviceId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(payload));
            console.log(`Command ${status} SENT to ${deviceId} ${status === "ON" ? "(with schedule times)" : ""}`);
            sent = true;
        }
    });

    if (!sent) console.log(`Device ${deviceId} not connected`);
    return sent;
};

const reconcileMissedCommands = async (deviceId, ws) => {
    try {
        const now = new Date();
        const todayDate = now.toISOString().split("T")[0];

        const currentDay = now.getUTCDay();
        const dayMapReverse = {
            0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
            4: "thursday", 5: "friday", 6: "saturday"
        };

        const today = dayMapReverse[currentDay];
        const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;

        // Get ALL active schedules (don't filter by day here)
        const schedules = await scheduleModel.find({
            deviceId,
            status: "ACTIVE"
        });

        if (!schedules.length) {
            console.log(`🔄 No active schedules found for device ${deviceId}`);
            return;
        }

        let activeSchedule = null;

        for (const schedule of schedules) {
            const relevantDays = getScheduleDaysForCheck(schedule);

            // Skip if today is not part of this schedule (including overnight)
            if (!relevantDays.includes(today)) continue;

            const { startTime, endTime } = schedule;
            const isOvernightSchedule = isOvernight(startTime, endTime);

            let isCurrentlyActive = false;

            if (!isOvernightSchedule) {
                if (currentTime >= startTime && currentTime < endTime) {
                    isCurrentlyActive = true;
                }
            } else {
                // Overnight schedule
                if (currentTime >= startTime || currentTime < endTime) {
                    isCurrentlyActive = true;
                }
            }

            if (isCurrentlyActive) {
                activeSchedule = schedule;
                break;
            }
        }

        if (!activeSchedule) {
            console.log(`🔄 Device ${deviceId} is currently OUTSIDE any schedule window`);
            return;
        }

        console.log(`🔄 Device ${deviceId} is INSIDE schedule → checking skip status`);

        // Check if user skipped this schedule today
        const skipped = await scheduleSkipModel.findOne({
            deviceId,
            scheduleId: activeSchedule._id,
            date: todayDate
        });

        if (skipped) {
            console.log(`⛔ Event was skipped today for device ${deviceId} → NOT sending ON`);
            return;
        }

        // Send ON command to sync device state
        console.log(`✅ Sending ON command to device ${deviceId} (reconciliation)`);
        await sendCommandToESP(deviceId, "ON");

    } catch (err) {
        console.error(`❌ Reconciliation Error for ${deviceId}:`, err.message);
    }
};

// const reconcileMissedCommands = async (deviceId, ws) => {
//     try {
//         const now = new Date();

//         // ✅ Get UTC day (0–6)
//         const currentDay = now.getUTCDay();

//         // Map to string (same as your DB)
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

//         // ✅ Get current UTC time in HH:mm
//         const hours = String(now.getUTCHours()).padStart(2, "0");
//         const minutes = String(now.getUTCMinutes()).padStart(2, "0");
//         const currentTime = `${hours}:${minutes}`;

//         // 🔥 Find schedules for today
//         const schedules = await scheduleModel.find({
//             deviceId,
//             days: today,
//             status: "ACTIVE"
//         });

//         if (!schedules.length) {
//             console.log(`🔄 No schedule for today (${today})`);
//             return;
//         }

//         // 🔥 Check if current time falls in any schedule
//         let activeSchedule = null;

//         for (const schedule of schedules) {
//             const { startTime, endTime } = schedule;

//             // Handle normal case
//             if (startTime < endTime) {
//                 if (currentTime >= startTime && currentTime < endTime) {
//                     activeSchedule = schedule;
//                     break;
//                 }
//             }
//             // 🔥 Handle midnight crossover (IMPORTANT)
//             else {
//                 if (
//                     currentTime >= startTime || currentTime < endTime
//                 ) {
//                     activeSchedule = schedule;
//                     break;
//                 }
//             }
//         }

//         if (!activeSchedule) {
//             console.log(`🔄 Device ${deviceId} is currently OUTSIDE schedule`);
//             return;
//         }

//         console.log(`🔄 Device ${deviceId} is INSIDE schedule → sending ON`);

//         const todayDate = now.toISOString().split("T")[0];

//         const skipped = await scheduleSkipModel.findOne({
//             deviceId,
//             scheduleId: activeSchedule._id,
//             date: todayDate
//         });

//         if (skipped) {
//             console.log(`⛔ Event already skipped for device ${deviceId} → NOT sending ON`);
//             return; 
//         }

//         await sendCommandToESP(deviceId, "ON");

//     } catch (err) {
//         console.error(`❌ Reconciliation Error for ${deviceId}:`, err.message);
//     }
// };


module.exports = { schedulingSocket, sendCommandToESP };
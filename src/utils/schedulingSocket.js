const WebSocket = require("ws");
const deviceModel = require("../models/deviceModel");
const scheduleModel = require("../models/scheduleModel");
const moment = require("moment-timezone");

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
            if (data.ack) {
                console.log("⏭ ACK received, skipping DB update");
                return;
            }

            // ==================== ONLY PROCESS SENSOR DATA ====================
            if (data.temperature || data.humidity || data.current || data.voltage) {

                try {
                    const updatePayload = {
                        lastUpdateTime: moment().tz("Asia/Karachi").format()
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
    if (status === "ON") {
        try {
            const now = moment().tz("Asia/Karachi").toDate();

            const activeSchedule = await scheduleModel.findOne({
                deviceId,
                startTime: { $lte: now },
                endTime: { $gt: now }
            }).sort({ startTime: -1 });

            if (activeSchedule) {
                payload.startTimeUnix = Math.floor(activeSchedule.startTime.getTime() / 1000);
                payload.endTimeUnix = Math.floor(activeSchedule.endTime.getTime() / 1000);

                console.log(`📅 ON command enriched with times → endTimeUnix: ${payload.endTimeUnix}`);
            }
        } catch (err) {
            console.error("Failed to fetch schedule times for ON command:", err.message);
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

// const sendCommandToESP = (deviceId, status) => {
//     if (!schedulingWss) return false;

//     let sent = false;
//     schedulingWss.clients.forEach((client) => {
//         if (client.deviceId === deviceId && client.readyState === WebSocket.OPEN) {
//             client.send(JSON.stringify({
//                 type: "COMMAND",
//                 command: status,
//                 deviceId: deviceId,
//                 timestamp: new Date().toISOString()
//             }));
//             console.log(`Command ${status} SENT to ${deviceId}`);
//             sent = true;
//         }
//     });

//     if (!sent) console.log(`Device ${deviceId} not connected`);
//     return sent;
// };

// ====================== RECONCILIATION FUNCTION ======================


const reconcileMissedCommands = async (deviceId) => {   // ← removed ws param (not needed)
    try {
        const now = moment().tz("Asia/Karachi");

        const activeSchedules = await scheduleModel.find({
            deviceId,
            startTime: { $lte: now.toDate() },
            endTime: { $gt: now.toDate() }
        })
            .sort({ startTime: -1 })
            .limit(1);

        if (activeSchedules.length === 0) {
            console.log(`🔄 Reconciliation: No active schedule for ${deviceId}`);
            return;
        }

        const schedule = activeSchedules[0];
        console.log(`🔄 Reconciliation: Sending missed ON with endTimeUnix for ${deviceId}`);

        await sendCommandToESP(deviceId, schedule.status);   // ← now awaits

    } catch (err) {
        console.error(`❌ Reconciliation Error for ${deviceId}:`, err.message);
    }
};

// const reconcileMissedCommands = async (deviceId, ws) => {
//     try {
//         const now = moment().tz("Asia/Karachi");

//         // Find all schedules that are CURRENTLY "in progress"
//         const activeSchedules = await scheduleModel.find({
//             deviceId,
//             startTime: { $lte: now.toDate() },     // started already
//             endTime: { $gt: now.toDate() }      // NOT yet ended
//         })
//             .sort({ startTime: -1 })   // most recent schedule first
//             .limit(1);

//         if (activeSchedules.length === 0) {
//             console.log(`🔄 Reconciliation: No active schedule in progress for ${deviceId}`);
//             return;
//         }

//         const schedule = activeSchedules[0];
//         const missedCommand = schedule.status;   // "ON" or "OFF" (your startAction)

//         console.log(`🔄 Reconciliation: Device ${deviceId} reconnected during active schedule → sending missed command "${missedCommand}"`);

//         // Reuse your existing function (it will find the connected client)
//         const sent = sendCommandToESP(deviceId, missedCommand);

//         if (sent) {
//             console.log(`✅ Reconciliation SUCCESS: ${missedCommand} sent to ${deviceId}`);
//         } else {
//             console.warn(`⚠️ Reconciliation: Command could not be sent (very rare - socket closed instantly)`);
//         }

//     } catch (err) {
//         console.error(`❌ Reconciliation Error for ${deviceId}:`, err.message);
//     }
// };

module.exports = { schedulingSocket, sendCommandToESP };
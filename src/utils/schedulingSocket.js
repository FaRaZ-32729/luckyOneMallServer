const WebSocket = require("ws");
const deviceModel = require("../models/deviceModel");
const moment = require("moment-timezone");

let schedulingWss;

// const schedulingSocket = (server) => {
//     schedulingWss = new WebSocket.Server({ noServer: true });
//     console.log("Scheduling Devices WebSocket Initialized");

//     schedulingWss.on("connection", (ws, req) => {
//         const serverIp = req.socket.remoteAddress;
//         console.log(`Scheduling Device connected from ${serverIp}`);

//         ws.deviceId = null;

//         ws.on("message", async (message) => {
//             console.log("Received from ESP32:", message.toString());

//             let data;
//             try {
//                 data = JSON.parse(message);
//             } catch (err) {
//                 console.log("Non-JSON message received");
//                 return;
//             }

//             if (!data.deviceId) {
//                 console.log("❌ No deviceId in payload");
//                 return;
//             }

//             // ==================== HANDSHAKE / AUTH ====================
//             if (data.action === "HANDSHAKE" && data.deviceId && data.deviceType) {
//                 ws.deviceId = data.deviceId;
//                 console.log(`✅ Device Authenticated: ${data.deviceId} (${data.deviceType})`);

//                 ws.send(JSON.stringify({
//                     type: "AUTH_SUCCESS",
//                     message: "Device registered successfully"
//                 }));
//                 return;   // Only return for handshake
//             }
//             console.log(data , ">>>> from esp")

//             // ==================== SENSOR DATA UPDATE ====================
//             ws.deviceId = data.deviceId;   // Ensure it's set

//             try {
//                 const updatePayload = {
//                     lastUpdateTime: moment().tz("Asia/Karachi").format()
//                 };

//                 if (data.temperature !== undefined) {
//                     updatePayload.espTemprature = data.temperature;
//                     updatePayload.temperatureAlert = data.temperatureAlert === "HIGH";
//                 }
//                 if (data.humidity !== undefined) {
//                     updatePayload.espHumidity = data.humidity;
//                     updatePayload.humidityAlert = data.humidityAlert === "HIGH";
//                 }
//                 if (data.current !== undefined) {
//                     updatePayload.espCurrent = data.current;
//                     updatePayload.currentAlert = data.currentAlert === "HIGH";
//                 }
//                 if (data.voltage !== undefined) {
//                     updatePayload.espVoltage = data.voltage;
//                     updatePayload.voltageAlert = data.voltageAlert === "HIGH";
//                 }

//                 const updated = await deviceModel.findOneAndUpdate(
//                     { deviceId: data.deviceId },
//                     updatePayload,
//                     { new: true }
//                 );

//                 console.log(`✅ MongoDB Updated Successfully for: ${data.deviceId}`);
//                 if (updated) {
//                     console.log(`   Temperature: ${updated.espTemprature}, Humidity: ${updated.espHumidity}`);
//                 }

//             } catch (error) {
//                 console.error("❌ DB Update Error:", error.message);
//             }
//         });

//         ws.on("close", () => {
//             console.log(`Device disconnected: ${ws.deviceId || 'Unknown'}`);
//         });

//         ws.on("error", (err) => {
//             console.error("WebSocket Error:", err.message);
//         });

//         // Welcome Message
//         setTimeout(() => {
//             if (ws.readyState === WebSocket.OPEN) {
//                 ws.send(JSON.stringify({ serverMsg: "Connected to Scheduling Server" }));
//             }
//         }, 1000);
//     });

//     return schedulingWss;
// };

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
const sendCommandToESP = (deviceId, status) => {
    if (!schedulingWss) return false;

    let sent = false;
    schedulingWss.clients.forEach((client) => {
        if (client.deviceId === deviceId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: "COMMAND",
                command: status,
                deviceId: deviceId,
                timestamp: new Date().toISOString()
            }));
            console.log(`Command ${status} SENT to ${deviceId}`);
            sent = true;
        }
    });

    if (!sent) console.log(`Device ${deviceId} not connected`);
    return sent;
};

module.exports = { schedulingSocket, sendCommandToESP };
// sockets/schedulingSocket.js
const WebSocket = require("ws");
const deviceModel = require("../models/deviceModel");
const moment = require("moment-timezone");

const schedulingSocket = (server) => {
    const schedWss = new WebSocket.Server({ noServer: true });
    console.log("Scheduling Devices WebSocket Initialized");

    schedWss.on("connection", (ws, req) => {
        const serverIp = req.socket.remoteAddress;
        console.log(`Scheduling Device (ESP32) connected from ${serverIp}`);

        // Optional: Store connected clients with deviceId for easy command sending
        ws.deviceId = null;

        ws.on("message", async (message) => {
            console.log("Received from Scheduling Device:", message.toString());

            let data;
            try {
                data = JSON.parse(message);
            } catch (err) {
                console.log("Non-JSON message received");
                return;
            }

            if (!data.deviceId) {
                console.log("deviceId missing in payload");
                return;
            }

            // Attach deviceId to socket for future command sending
            ws.deviceId = data.deviceId;

            try {
                const device = await deviceModel.findOne({ deviceId: data.deviceId });
                if (!device) {
                    console.log("Device not found:", data.deviceId);
                    return;
                }

                const updatePayload = { 
                    lastUpdateTime: moment().tz("Asia/Karachi").format() 
                };

                const type = device.deviceType;

                // ==================== Update Sensor Data ====================
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

                // Update in Database
                await deviceModel.findOneAndUpdate(
                    { deviceId: data.deviceId },
                    updatePayload,
                    { new: true }
                );

                console.log(`✅ Updated scheduling device: ${data.deviceId}`);

            } catch (error) {
                console.error("Error updating scheduling device:", error.message);
            }
        });

        ws.on("close", () => {
            console.log(`Scheduling Device disconnected: ${ws.deviceId || 'Unknown'}`);
        });

        ws.on("error", (err) => {
            console.error("Scheduling WS Error:", err.message);
        });

        // Send welcome message
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ serverMsg: "Connected to Scheduling Server" }));
            }
        }, 1000);
    });

    return schedWss;
};

module.exports = { schedulingSocket };
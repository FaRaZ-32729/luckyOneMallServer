const WebSocket = require("ws");
const deviceModel = require("../models/deviceModel");
const moment = require("moment-timezone");

const espAlertSocket = (server) => {
    const wSocket = new WebSocket.Server({ noServer: true });
    console.log("WebSocket initialized");

    wSocket.on("connection", (ws, req) => {
        const serverIp = req.socket.remoteAddress;
        console.log(`ESP32 connected from ${serverIp}`);

        ws.on("message", async (message) => {
            console.log("Received:", message.toString());

            let data;
            try {
                data = JSON.parse(message);
            } catch (err) {
                console.log("Non-JSON message:", message.toString());
                return;
            }

            try {
                // Validate device exists
                const device = await deviceModel.findOne({ deviceId: data.deviceId });
                if (!device) {
                    console.log("Device not found:", data.deviceId);
                    return;
                }

                // Determine device type
                const type = device.deviceType;
                if (!type) {
                    console.log("Invalid Device Type ", type);
                    return;
                }
                const updatePayload = { lastUpdateTime: moment().tz("Asia/Karachi").format() };

                // Update fields based on device type
                if (type === "TMD") {
                    if (data.temperature !== undefined) {
                        updatePayload.espTemprature = data.temperature;
                        updatePayload.temperatureAlert = data.temperatureAlert === "HIGH";
                    }
                    if (data.humidity !== undefined) {
                        updatePayload.espHumidity = data.humidity;
                        updatePayload.humidityAlert = data.humidityAlert === "HIGH";
                    }
                }

                if (type === "OMD") {
                    if (data.temperature !== undefined) {
                        updatePayload.espTemprature = data.temperature;
                        updatePayload.temperatureAlert = data.temperatureAlert === "HIGH";
                    }
                    if (data.humidity !== undefined) {
                        updatePayload.espHumidity = data.humidity;
                        updatePayload.humidityAlert = data.humidityAlert === "HIGH";
                    }
                    if (data.odour !== undefined) {
                        updatePayload.espOdour = data.odour;
                        updatePayload.odourAlert = data.odourAlert === "DETECTED";
                    }
                }

                if (type === "AQIMD") {
                    if (data.temperature !== undefined) {
                        updatePayload.espTemprature = data.temperature;
                        updatePayload.temperatureAlert = data.temperatureAlert === "HIGH";
                    }
                    if (data.humidity !== undefined) {
                        updatePayload.espHumidity = data.humidity;
                        updatePayload.humidityAlert = data.humidityAlert === "HIGH";
                    }
                    if (data.AQI !== undefined) {
                        updatePayload.espAQI = data.AQI;
                        updatePayload.aqiAlert = data.AQIAlert === "POOR";
                    }
                }

                if (type === "GLMD") {
                    if (data.temperature !== undefined) {
                        updatePayload.espTemprature = data.temperature;
                        updatePayload.temperatureAlert = data.temperatureAlert === "HIGH";
                    }
                    if (data.humidity !== undefined) {
                        updatePayload.espHumidity = data.humidity;
                        updatePayload.humidityAlert = data.humidityAlert === "HIGH";
                    }
                    if (data.gass !== undefined) {
                        updatePayload.espGL = data.gass;
                        updatePayload.glAlert = data.gassAlert === "LEAK";
                    }
                }

                // Update MongoDB
                const updatedDevice = await deviceModel.findOneAndUpdate(
                    { deviceId: data.deviceId },
                    updatePayload,
                    { new: true }
                );

                // console.log("Updated device:", updatedDevice);
                const loggedData = { deviceId: updatedDevice.deviceId };
                for (const key of Object.keys(updatePayload)) {
                    loggedData[key] = updatedDevice[key];
                }

                console.log("Updated device:", loggedData);
            } catch (error) {
                console.error("Error updating device:", error.message);
            }
        });

        ws.on("close", (code, reason) => {
            console.log(`ESP32 disconnected (code: ${code}, reason: ${reason})`);
        });

        ws.on("error", (error) => {
            console.error("WebSocket Error", error.message);
        });

        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('{"serverMsg":"Hello ESP32"}');
                console.log("Confirmation message sent to ESP32");
            }
        }, 1000);
    });

    return wSocket;
};

module.exports = { espAlertSocket };

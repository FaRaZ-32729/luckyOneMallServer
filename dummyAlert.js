const WebSocket = require("ws");

const SERVER_URL = "ws://localhost:5050/ws/alerts";

const DEVICES = [
    "device-001",
    "device-002",
    "device-003",
];

// generates random values
function getRandomValue(min, max) {
    return (Math.random() * (max - min) + min).toFixed(2);
}

// simulate one device connection
function simulateDevice(deviceId) {
    const ws = new WebSocket(SERVER_URL);

    // sends heartbeat 
    // const heartbeatInterval = setInterval(() => {
    //     if (ws.readyState === WebSocket.OPEN) {
    //         const heartbeat = {
    //             type: "heartbeat",
    //             deviceId: deviceId,
    //             timestamp: new Date().toISOString()
    //         };

    //         ws.send(JSON.stringify(heartbeat));
    //         console.log(`[${deviceId}] Heartbeat sent`);
    //     }
    // }, 5000);

    ws.on("open", () => {
        console.log(`[${deviceId}] Connected to WebSocket Server`);

        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                const payload = {
                    deviceId,
                    humidity: getRandomValue(30, 90),
                    temperature: getRandomValue(10, 40),
                    humidityAlert: Math.random() > 0.8 ? "HIGH" : "NORMAL",
                    temperatureAlert: Math.random() > 0.85 ? "HIGH" : "NORMAL",
                    odourAlert: Math.random() > 0.9 ? "DETECTED" : "NORMAL  ",
                    timestamp: new Date().toISOString(),
                };

                ws.send(JSON.stringify(payload));
                console.log(`[${deviceId}] Sent:`, payload);
            }
        }, 10000);

        ws.on("close", () => {
            console.log(`[${deviceId}] Disconnected from server`);
            clearInterval(interval);
            clearInterval(heartbeatInterval);
        });

        ws.on("error", (err) => {
            console.error(`[${deviceId}] WebSocket Error:`, err.message);
        });

        ws.on("message", (msg) => {
            console.log(`[${deviceId}] Message from server: ${msg.toString()}`);
        });
    });
}

// simulation for all devices
DEVICES.forEach((id) => simulateDevice(id));
const WebSocket = require("ws");
const deviceModel = require("../models/deviceModel");
const moment = require("moment-timezone");

const espAlertSocket = (server) => {
    const wSocket = new WebSocket.Server({ noServer: true });
    console.log("web-socket initialized");

    wSocket.on("connection", (ws, req) => {
        const serverIp = req.socket.remoteAddress;
        console.log(`esp32 connected from ${serverIp}`);


        ws.on("message", async (message) => {
            console.log(message.toString());

            try {
                // const data = JSON.parse(message);
                // console.log("parsed json data => ", data);

                let data;

                try {
                    data = JSON.parse(message);
                    console.log("parsed json data => ", data);
                } catch {
                    console.log("non-JSON message:", message.toString());
                    return;
                }
                // new checks last heartbeat
                // if (data.type === "heartbeat") {
                //     ws.lastBeat = Date.now();
                //     return;
                // }

                await deviceModel.findOneAndUpdate(
                    { deviceId: data.deviceId },
                    {
                        espTemprature: data.temperature,
                        espHumidity: data.humidity,
                        espOdour: data.odor,
                        temperatureAlert: data.temperatureAlert === "HIGH",
                        humidityAlert: data.humidityAlert === "HIGH",
                        odourAlert: data.odourAlert === "DETECTED",
                        lastUpdateTime: moment().tz("Asia/Karachi").format()
                    },
                    // { upsert: true, new: true }
                    { new: true }
                );
            } catch (error) {
                console.log("trouble while getting data or updating Mongodb");
                console.error("error: ", error.message)
            }

        });

        // new if heart beat not found after 10s it shows connection lost in console
        // setInterval(() => {
        //     wSocket.clients.forEach((ws) => {
        //         if (!ws.lastBeat) ws.lastBeat = Date.now();

        //         if (Date.now() - ws.lastBeat > 10000) {
        //             console.log("ESP32 LOST! Force disconnect.");
        //             ws.terminate();
        //         }
        //     });
        // }, 5000);

        ws.on("close", (code, reason) => {
            console.log(`esp32 disconnected (code: ${code} , reason: ${reason} )`);
        });

        ws.on("error", (error) => {
            console.error("Web-Socket Error", error.message);
        });

        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('{"serverMsg : Hellow ESP32}');
                console.log("Confirmation Message Send to ESP32");
            }
        }, 1000);
    });


    return wSocket;
}

module.exports = { espAlertSocket };
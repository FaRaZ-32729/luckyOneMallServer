// // src/workers/scheduleWorker.js
// require("dotenv").config();
// const { Worker } = require("bullmq");
// const connection = require("../config/redisConnection");
// const { sendCommandToESP } = require("../utils/schedulingSocket");

// const worker = new Worker(
//     "schedule-queue",
//     async (job) => {
//         const { deviceId, action } = job.data;

//         console.log(`🚀 Executing: ${deviceId} -> ${action}`);

//         sendCommandToESP(deviceId, action);
//     },
//     { connection }
// );

// worker.on("completed", (job) => {
//     console.log(`✅ Job Done: ${job.id}`);
// });

// worker.on("failed", (job, err) => {
//     console.log(`❌ Job Failed: ${job.id}`, err.message);
// });


// require("dotenv").config();
// const { Worker } = require("bullmq");
// const connection = require("../config/redisConnection");

// const worker = new Worker(
//     "schedule-queue",
//     async (job) => {
//         const { deviceId, action } = job.data;

//         console.log(`🚀 Executing Job: ${deviceId} -> ${action}`);

//         // ❌ DO NOT send WebSocket here
//         return { deviceId, action };
//     },
//     { connection }
// );

// worker.on("completed", (job, result) => {
//     console.log(`✅ Job Done: ${job.id}`);

//     // 🔥 Emit event to main server via global function
//     global.sendToESP?.(result.deviceId, result.action);
// });



// src/workers/scheduleWorker.js


// src/utils/scheduleWorker.js
const path = require("path");
require("dotenv").config({ 
    path: path.resolve(__dirname, "../../.env") 
});

const { Worker } = require("bullmq");
const connection = require("../config/redisConnection");
const axios = require("axios");

console.log("🚀 Schedule Worker Starting...");
console.log("REDIS_URL Loaded:", process.env.REDIS_URL ? "✅ YES" : "❌ NO");

const worker = new Worker(
    "schedule-queue",
    async (job) => {
        const { deviceId, action } = job.data;
        console.log(`🚀 Executing Job: ${deviceId} → ${action}`);

        try {
            await axios.post("http://localhost:5051/schedule/trigger", {
                deviceId,
                action
            }, {
                headers: { "Content-Type": "application/json" },
                timeout: 10000
            });
            console.log(`✅ ${action} command sent to main server`);
        } catch (err) {
            console.error(`❌ Failed to notify main server:`, err.message);
        }
    },
    { connection }
);

worker.on("ready", () => {
    console.log("✅ BullMQ Worker is Ready & Connected to Redis Cloud");
});

worker.on("completed", (job) => console.log(`✅ Job Completed: ${job.id}`));
worker.on("failed", (job, err) => console.error(`❌ Job Failed: ${job.id}`, err.message));
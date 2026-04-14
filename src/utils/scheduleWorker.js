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

require("dotenv").config();
const { Worker } = require("bullmq");
const connection = require("../config/redisConnection");
const axios = require("axios");   // ← Add this

const worker = new Worker(
    "schedule-queue",
    async (job) => {
        const { deviceId, action } = job.data;

        console.log(`🚀 Executing Job: ${deviceId} -> ${action}`);

        // Notify main server instead of using global
        try {
            await axios.post("http://localhost:5051/schedule/trigger", {
                deviceId,
                action
            }, {
                headers: { "Content-Type": "application/json" }
            });
        } catch (err) {
            console.error("Failed to notify main server:", err.message);
        }

        return { deviceId, action };
    },
    { connection }
);

worker.on("completed", (job) => {
    console.log(`Job Completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
    console.error(`Job Failed: ${job.id}`, err);
});
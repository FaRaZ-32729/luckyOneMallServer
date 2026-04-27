// src/utils/scheduleWorker.js
// const path = require("path");
// require("dotenv").config({
//     path: path.resolve(__dirname, "../../.env")
// });

// const { Worker } = require("bullmq");
// const connection = require("../config/redisConnection");
// const axios = require("axios");

// console.log("🚀 Schedule Worker Starting...");
// console.log("REDIS_URL Loaded:", process.env.REDIS_URL ? "✅ YES" : "❌ NO");

// const worker = new Worker(
//     "schedule-queue",
//     async (job) => {
//         const { deviceId, action } = job.data;
//         console.log("JOB DATA:", job.data);
//         console.log(`🚀 Executing Job: ${deviceId} → ${action}`);

//         try {
//             console.log("Calling API...");
//             await axios.post("http://localhost:5051/schedule/trigger", {
//                 deviceId,
//                 action
//             }, {
//                 headers: { "Content-Type": "application/json" },
//                 timeout: 10000
//             });
//             console.log(`✅ ${action} command sent to main server`);
//         } catch (err) {
//             console.error(`❌ Failed to notify main server:`, err.message);
//         }
//     },
//     { connection }
// );

// worker.on("ready", () => {
//     console.log("✅ BullMQ Worker is Ready & Connected to Redis Cloud");
// });

// worker.on("completed", (job) => console.log(`✅ Job Completed: ${job.id}`));
// worker.on("failed", (job, err) => console.error(`❌ Job Failed: ${job.id}`, err.message));



const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "../../.env")
});

const { Worker } = require("bullmq");
const connection = require("../config/redisConnection");
const axios = require("axios");
const mongoose = require("mongoose");

// 🔥 NEW IMPORTS
const scheduleModel = require("../models/scheduleModel");
const scheduleSkipModel = require("../models/scheduleSkipModel");

console.log("🚀 Schedule Worker Starting...");
console.log("REDIS_URL Loaded:", process.env.REDIS_URL ? "✅ YES" : "❌ NO");


mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log("✅ Worker MongoDB Connected"))
    .catch(err => console.error("❌ Worker DB Error:", err));

const worker = new Worker(
    "schedule-queue",
    async (job) => {
        const { deviceId, action } = job.data;

        console.log("JOB DATA:", job.data);
        console.log(`🚀 Executing Job: ${deviceId} → ${action}`);

        try {
            // ==================== 🔥 SKIP LOGIC START ====================
            const now = new Date();

            const todayDate = now.toISOString().split("T")[0];

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

            // 🔥 Get today's schedules
            const schedules = await scheduleModel.find({
                deviceId,
                days: today,
                status: "ACTIVE"
            });

            let matchedSchedule = null;

            for (const schedule of schedules) {
                const { startTime, endTime } = schedule;

                if (action === "ON") {
                    // normal window match
                    if (startTime < endTime) {
                        if (currentTime >= startTime && currentTime < endTime) {
                            matchedSchedule = schedule;
                            break;
                        }
                    } else {
                        if (currentTime >= startTime || currentTime < endTime) {
                            matchedSchedule = schedule;
                            break;
                        }
                    }
                }

                else if (action === "OFF") {
                    // 🔥 FIX: match exact endTime
                    if (currentTime === endTime) {
                        matchedSchedule = schedule;
                        break;
                    }
                }
            }

            // 🔥 CHECK IF SKIPPED
            if (matchedSchedule) {
                const skipped = await scheduleSkipModel.findOne({
                    deviceId,
                    scheduleId: matchedSchedule._id,
                    date: todayDate
                });

                if (skipped) {
                    console.log(`⛔ Skipped ${action} job ignored for ${deviceId}`);
                    return; // 🚫 STOP HERE (no API call)
                }
            }
            // ==================== 🔥 SKIP LOGIC END ====================
            if (!matchedSchedule) {
                console.log(`⛔ No ACTIVE schedule matched → skipping ${action} for ${deviceId}`);
                return;
            }


            // ==================== EXISTING FLOW ====================
            console.log("Calling API...");
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
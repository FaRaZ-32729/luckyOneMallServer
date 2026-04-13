// src/queues/scheduleQueue.js
const { Queue } = require("bullmq");
const connection = require("../config/redisConnection");

const scheduleQueue = new Queue("schedule-queue", {
    connection
});

module.exports = scheduleQueue;
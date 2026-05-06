// const IORedis = require("ioredis");

// const redisConnection = new IORedis(process.env.REDIS_URL, {
//     maxRetriesPerRequest: null,   // 🔥 REQUIRED for BullMQ
//     tls: {}                       // 🔥 required for rediss (Upstash)
// });

// // ================== EVENTS ==================
// redisConnection.on("connect", () => {
//     console.log("Redis Connected Successfully");
// });

// redisConnection.on("ready", () => {
//     console.log("Redis is Ready to Use");
// });

// redisConnection.on("error", (err) => {
//     console.error("Error while connecting with Redis:", err.message);
// });

// redisConnection.on("close", () => {
//     console.log("Redis Connection Closed");
// });

// module.exports = redisConnection;



const IORedis = require("ioredis");

const redisConnection = new IORedis({
    host: "127.0.0.1",
    port: 6379,
    password: "Growmore12345@",
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});
// ================== EVENTS ==================

redisConnection.on("connect", () => {
    console.log("🔌 Redis: Connecting...");
});

redisConnection.on("ready", () => {
    console.log("✅ Redis: Connected & Ready to use");
});

redisConnection.on("error", (err) => {
    console.error("❌ Redis Error:", err.message);
});

redisConnection.on("close", () => {
    console.log("⚠️ Redis Connection Closed");
});

redisConnection.on("reconnecting", () => {
    console.log("🔄 Redis Reconnecting...");
});

redisConnection.on("end", () => {
    console.log("⛔ Redis Connection Ended");
});

module.exports = redisConnection;
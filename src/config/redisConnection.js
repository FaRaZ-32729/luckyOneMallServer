// config/redis.js

const IORedis = require("ioredis");

const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,   // 🔥 REQUIRED for BullMQ
    tls: {}                       // 🔥 required for rediss (Upstash)
});

// ================== EVENTS ==================
redisConnection.on("connect", () => {
    console.log("✅ Redis Connected Successfully");
});

redisConnection.on("ready", () => {
    console.log("🚀 Redis Ready to Use");
});

redisConnection.on("error", (err) => {
    console.error("❌ Redis Error:", err.message);
});

redisConnection.on("close", () => {
    console.log("⚠️ Redis Connection Closed");
});

module.exports = redisConnection;
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

// Connection to Valkey (drop-in replacement for Redis)
const connection = new IORedis({
  host: process.env.VALKEY_HOST || "127.0.0.1",
  port: process.env.VALKEY_PORT || 6379,
  maxRetriesPerRequest: null,
});

const mlQueue = new Queue("ml-inference", { connection });

module.exports = { mlQueue, connection };

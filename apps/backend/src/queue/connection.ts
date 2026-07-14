import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

// BullMQ requires maxRetriesPerRequest: null on the connection it's given,
// otherwise ioredis's own retry logic fights with BullMQ's.
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

// Without this listener, any transient network blip (common on free-tier
// hosted Redis over TLS) becomes an uncaught exception and crashes the
// whole process instead of just reconnecting.
redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});
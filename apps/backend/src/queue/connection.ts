import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

// Used directly (e.g. for caching, pub/sub outside BullMQ).
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

// BullMQ bundles its own ioredis copy internally. Passing it our own
// IORedis *instance* causes a TS type conflict between the two copies.
// Passing plain connection options instead lets BullMQ build its own
// connection with its bundled ioredis — no conflict.
const parsed = new URL(REDIS_URL);
export const bullConnectionOptions = {
  host: parsed.hostname,
  port: Number(parsed.port || 6379),
  username: parsed.username || undefined,
  password: parsed.password || undefined,
  tls: parsed.protocol === "rediss:" ? {} : undefined,
  maxRetriesPerRequest: null as null,
};
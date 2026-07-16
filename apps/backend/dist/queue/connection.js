"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullConnectionOptions = exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
    throw new Error("REDIS_URL is not set");
}

exports.redisConnection = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 5000),
});
exports.redisConnection.on("error", (err) => {
    console.error("Redis connection error:", err.message);
});

const parsed = new URL(REDIS_URL);
exports.bullConnectionOptions = {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
};

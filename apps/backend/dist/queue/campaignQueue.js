"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignQueue = exports.CAMPAIGN_QUEUE_NAME = void 0;
exports.enqueueCampaignSend = enqueueCampaignSend;
exports.cancelCampaignSend = cancelCampaignSend;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
exports.CAMPAIGN_QUEUE_NAME = "campaign-send";
exports.campaignQueue = new bullmq_1.Queue(exports.CAMPAIGN_QUEUE_NAME, {
    connection: connection_1.bullConnectionOptions,
    defaultJobOptions: {
        // Keep a little history for debugging; don't let it grow unbounded.
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
    },
});
// BullMQ opens extra internal connections beyond the one we created (for
// blocking reads etc). Each needs its own error listener or a transient
// drop (common on free-tier hosted Redis) becomes an uncaught exception.
exports.campaignQueue.on("error", (err) => {
    console.error("Queue connection error:", err.message);
});
/**
 * Enqueue a campaign to be sent. `sendAt` in the future becomes a delayed
 * job (BullMQ computes `delay` from now); omit it (or pass a past date)
 * to send as soon as a worker picks it up.
 *
 * Because this is a real queued job stored in Redis (not a setTimeout or
 * an interval polling the DB), it survives the API server restarting -
 * only the worker process needs to be running when the delay elapses.
 */
async function enqueueCampaignSend(campaignId, sendAt) {
    const delay = sendAt ? Math.max(0, sendAt.getTime() - Date.now()) : 0;
    const job = await exports.campaignQueue.add("send", { campaignId }, {
        delay,
        jobId: `campaign-${campaignId}`, // stable id so we can look it up/cancel later
    });
    return job.id;
}
async function cancelCampaignSend(jobId) {
    const job = await exports.campaignQueue.getJob(jobId);
    if (job) {
        await job.remove();
    }
}
//# sourceMappingURL=campaignQueue.js.map
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
       
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
    },
});

exports.campaignQueue.on("error", (err) => {
    console.error("Queue connection error:", err.message);
});

async function enqueueCampaignSend(campaignId, sendAt) {
    const delay = sendAt ? Math.max(0, sendAt.getTime() - Date.now()) : 0;
    const job = await exports.campaignQueue.add("send", { campaignId }, {
        delay,
        jobId: `campaign-${campaignId}`, 
    });
    return job.id;
}
async function cancelCampaignSend(jobId) {
    const job = await exports.campaignQueue.getJob(jobId);
    if (job) {
        await job.remove();
    }
}

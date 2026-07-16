"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const campaignQueue_1 = require("./campaignQueue");
const prisma_1 = require("../lib/prisma");
const mailProvider_1 = require("../lib/mailProvider");
async function processCampaignJob(job) {
    const { campaignId } = job.data;
    const campaign = await prisma_1.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { recipients: { include: { contact: true } } },
    });
    if (!campaign) {
        console.warn(`Campaign ${campaignId} no longer exists, skipping`);
        return;
    }
    await prisma_1.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "SENDING" },
    });
    const matchedRecipients = campaign.recipients.filter((r) => r.status !== "UNMATCHED");
    let sentCount = 0;
    let failedCount = 0;
    for (const recipient of matchedRecipients) {
        const email = recipient.contact?.email ?? recipient.rawEmail;
        
        if (!email) {
            await prisma_1.prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: { status: "FAILED" },
            });
            failedCount++;
            continue;
        }
        try {
            const { providerMessageId } = await (0, mailProvider_1.sendEmail)({
                to: email,
                subject: campaign.subject,
                html: campaign.body,
            });
            await prisma_1.prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: { status: "SENT", sentAt: new Date(), providerMessageId },
            });
            sentCount++;
        }
        catch (err) {
            console.error(`Failed to send to ${email}:`, err.message);
            await prisma_1.prisma.campaignRecipient.update({
                where: { id: recipient.id },
                data: { status: "FAILED" },
            });
            failedCount++;
        }
    }
    await prisma_1.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "SENT" },
    });
    console.log(`Campaign ${campaignId}: ${sentCount} sent, ${failedCount} failed`);
}
const worker = new bullmq_1.Worker(campaignQueue_1.CAMPAIGN_QUEUE_NAME, processCampaignJob, { connection: connection_1.bullConnectionOptions, concurrency: 5 });
worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});
worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
    console.error("Worker connection error:", err.message);
});
console.log("Campaign worker started, waiting for jobs...");

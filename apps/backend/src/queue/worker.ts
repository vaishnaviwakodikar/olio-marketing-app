import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { CAMPAIGN_QUEUE_NAME } from "./campaignQueue";
import { prisma } from "../lib/prisma";

interface CampaignJobData {
  campaignId: string;
}

async function processCampaignJob(job: Job<CampaignJobData>) {
  const { campaignId } = job.data;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { recipients: true },
  });
  if (!campaign) {
    console.warn(`Campaign ${campaignId} no longer exists, skipping`);
    return;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  const matchedRecipients = campaign.recipients.filter(
    (r: (typeof campaign.recipients)[number]) => r.status !== "UNMATCHED"
  );

  for (const recipient of matchedRecipients) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENT" },
  });

  console.log(
    `Campaign ${campaignId} sent to ${matchedRecipients.length} recipients`
  );
}

const worker = new Worker<CampaignJobData>(
  CAMPAIGN_QUEUE_NAME,
  processCampaignJob,
  { connection: redisConnection, concurrency: 5 }
);

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